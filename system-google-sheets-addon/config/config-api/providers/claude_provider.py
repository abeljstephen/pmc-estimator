"""
Claude Provider Implementation
Uses Anthropic's Claude API
"""

import anthropic
from ..base_provider import BaseProvider, APIResponse


class ClaudeProvider(BaseProvider):
    """
    Claude API provider implementation.
    Supports all Claude models from Anthropic.
    """

    def __init__(self, config: dict, api_key: str):
        """Initialize Anthropic client"""
        super().__init__(config, api_key)
        self.client = anthropic.Anthropic(api_key=api_key)

    def call(self, messages: list, system_prompt: str = None, max_tokens: int = None) -> APIResponse:
        """
        Call Claude API.

        Args:
            messages: List of messages
            system_prompt: System message
            max_tokens: Max tokens (uses config default if None)

        Returns:
            APIResponse with Claude response
        """
        response = self.client.messages.create(
            model=self.config["model"],
            max_tokens=max_tokens or self.config.get("max_tokens", 4096),
            system=system_prompt,
            messages=messages,
        )

        cost = self.calculate_cost(response.usage.input_tokens, response.usage.output_tokens)

        return APIResponse(
            content=response.content[0].text,
            model=self.config["model"],
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            cost_usd=cost,
            provider="claude",
        )

    def calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """
        Calculate Claude cost based on current pricing.

        Pricing (as of Feb 2025):
        - Claude 3.5 Opus: $3/$15 per MTok
        - Claude 3.5 Sonnet: $3/$15 per MTok
        - Claude 3 Haiku: $0.80/$4 per MTok

        Args:
            input_tokens: Input token count
            output_tokens: Output token count

        Returns:
            Total cost in USD
        """
        billing = self.config["billing"]
        input_cost = (input_tokens * billing["input_per_mtok"]) / 1000
        output_cost = (output_tokens * billing["output_per_mtok"]) / 1000
        return round(input_cost + output_cost, 6)

    def validate_api_key(self) -> bool:
        """
        Test Claude API key validity.

        Makes a minimal API call to verify credentials.

        Returns:
            True if key is valid, False otherwise
        """
        try:
            response = self.client.messages.create(
                model=self.config["model"],
                max_tokens=10,
                messages=[{"role": "user", "content": "test"}],
            )
            return bool(response)
        except Exception as e:
            print(f"Claude API key validation failed: {e}")
            return False
