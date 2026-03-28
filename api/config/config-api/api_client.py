"""
Unified API Client
Provides a single interface for all agents to use any LLM provider.

Handles:
- Provider selection (config default or CLI override)
- Fallback providers
- Usage tracking & cost control
- Rate limiting
- Retry logic with exponential backoff
"""

import json
import time
from pathlib import Path
from typing import Optional
from .providers.provider_factory import ProviderFactory
from .usage_tracker import UsageTracker
from .credentials import CredentialsManager


class APIClient:
    """
    Unified API client for all agents.

    Abstracts away provider details - agents just call this without caring
    if they're using Claude, ChatGPT, Grok, etc.

    Example:
        client = APIClient("math-agent")
        response = client.call(messages, system_prompt="You are a mathematician")
        print(f"Used {response.provider}, cost: ${response.cost_usd}")
    """

    def __init__(
        self,
        agent_name: str,
        config_path: Optional[str] = None,
        preferred_provider: Optional[str] = None,
    ):
        """
        Initialize API client.

        Args:
            agent_name: Name of agent (must be in agency-config.json)
            config_path: Path to agency-config.json (auto-detects if None)
            preferred_provider: Override default provider ("claude", "chatgpt", "grok")
        """
        self.agent_name = agent_name
        self.preferred_provider = preferred_provider

        # Load config
        if config_path is None:
            config_path = Path(__file__).parent / "agency-config.json"
        else:
            config_path = Path(config_path)

        if not config_path.exists():
            raise FileNotFoundError(f"Config not found: {config_path}")

        with open(config_path) as f:
            self.config = json.load(f)

        # Initialize managers
        self.credentials = CredentialsManager(self.config)
        self.usage_tracker = UsageTracker(self.config)

        # Validate agent exists in config
        if agent_name not in self.config.get("agents", {}):
            available = ", ".join(self.config.get("agents", {}).keys())
            raise ValueError(f"Agent '{agent_name}' not found in config. Available: {available}")

        self.agent_config = self.config["agents"][agent_name]

    def call(
        self,
        messages: list,
        system_prompt: Optional[str] = None,
        max_tokens: Optional[int] = None,
    ):
        """
        Make API call with automatic provider selection, retries, and tracking.

        Args:
            messages: List of messages [{"role": "user", "content": "..."}]
            system_prompt: Optional system message
            max_tokens: Optional max tokens in response

        Returns:
            APIResponse object with content, provider, cost, tokens, etc.

        Raises:
            ValueError: If rate limit exceeded or cost limit reached
            Exception: If all providers fail
        """
        # Check rate limits
        within_daily_limit, requests_today, limit = self.usage_tracker.check_requests_per_agent_per_day(
            self.agent_name
        )
        if not within_daily_limit:
            raise ValueError(
                f"Daily request limit exceeded for {self.agent_name} "
                f"({requests_today}/{limit} requests today)"
            )

        # Check cost limits
        within_cost_limit, cost, limit = self.usage_tracker.check_cost_limit()
        if not within_cost_limit:
            raise ValueError(
                f"Monthly cost limit exceeded (${cost:.2f}/${limit}). "
                f"Increase hard_limit_dollars in agency-config.json"
            )

        # Determine which providers to try
        primary = self.preferred_provider or self.agent_config.get("provider", "claude")
        fallbacks = self.agent_config.get("fallback_providers", [])
        providers_to_try = [primary] + fallbacks

        last_error = None

        for provider_name in providers_to_try:
            try:
                # Get provider config
                if provider_name not in self.config.get("providers", {}):
                    raise ValueError(f"Provider '{provider_name}' not in config")

                provider_config = self.config["providers"][provider_name]

                # Get API key
                api_key = self.credentials.get(provider_name)

                # Create provider
                provider = ProviderFactory.create(provider_name, provider_config, api_key)

                # Make call with retries
                response = self._call_with_retries(provider, messages, system_prompt, max_tokens)

                # Log usage
                self.usage_tracker.log_request(
                    agent_name=self.agent_name,
                    provider=provider_name,
                    tokens_in=response.input_tokens,
                    tokens_out=response.output_tokens,
                    cost=response.cost_usd,
                    status="success",
                    metadata={"max_tokens": max_tokens},
                )

                return response

            except ValueError as e:
                # Rate limit or cost error - don't retry
                raise e

            except Exception as e:
                last_error = e
                provider_name_display = provider_name

                if provider_name == providers_to_try[-1]:
                    # Last provider failed
                    self.usage_tracker.log_request(
                        agent_name=self.agent_name,
                        provider=provider_name,
                        tokens_in=0,
                        tokens_out=0,
                        cost=0,
                        status="failure",
                        metadata={"error": str(e)},
                    )
                    raise Exception(f"All providers failed. Last error: {e}") from e
                else:
                    # Try next provider
                    print(f"Provider {provider_name} failed: {e}. Trying fallback...")
                    continue

    def _call_with_retries(self, provider, messages, system_prompt, max_tokens, max_attempts=3):
        """
        Call provider with exponential backoff retry.

        Args:
            provider: Provider instance
            messages: Message list
            system_prompt: System message
            max_tokens: Max tokens
            max_attempts: Max retry attempts

        Returns:
            APIResponse

        Raises:
            Exception: If all retries fail
        """
        for attempt in range(max_attempts):
            try:
                return provider.call(messages, system_prompt, max_tokens)

            except Exception as e:
                if attempt < max_attempts - 1:
                    wait_time = self.config["api"].get("retry_backoff_base", 2) ** attempt
                    print(f"Attempt {attempt + 1}/{max_attempts} failed. Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    raise

    def get_summary(self) -> dict:
        """Get usage summary for this agent"""
        return self.usage_tracker.get_usage_summary()

    def print_summary(self) -> None:
        """Print usage summary"""
        self.usage_tracker.print_summary()

    def print_status(self) -> None:
        """Print credential/provider status"""
        print("\n" + "=" * 70)
        print("PROVIDER STATUS")
        print("=" * 70)
        print(f"Agent: {self.agent_name}")
        print(f"Primary Provider: {self.agent_config.get('provider', 'default')}")
        fallbacks = self.agent_config.get("fallback_providers", [])
        if fallbacks:
            print(f"Fallback Providers: {', '.join(fallbacks)}")
        print()
        self.credentials.print_status()
