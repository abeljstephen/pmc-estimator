"""
Provider Factory
Routes agent calls to the correct LLM provider
"""

from .claude_provider import ClaudeProvider
from .chatgpt_provider import ChatGPTProvider
from .grok_provider import GrokProvider


class ProviderFactory:
    """
    Factory pattern for creating provider instances.

    Manages which providers are available and routes to the correct one.
    """

    PROVIDERS = {
        "claude": ClaudeProvider,
        "chatgpt": ChatGPTProvider,
        "grok": GrokProvider,
    }

    @staticmethod
    def create(provider_name: str, config: dict, api_key: str):
        """
        Create a provider instance.

        Args:
            provider_name: Name of provider ("claude", "chatgpt", "grok")
            config: Provider config from agency-config.json
            api_key: API key from environment

        Returns:
            Provider instance (BaseProvider subclass)

        Raises:
            ValueError: If provider unknown or not enabled
        """
        provider_name_lower = provider_name.lower()

        if provider_name_lower not in ProviderFactory.PROVIDERS:
            available = ", ".join(ProviderFactory.PROVIDERS.keys())
            raise ValueError(
                f"Unknown provider: '{provider_name}'. "
                f"Available providers: {available}"
            )

        if not config.get("enabled"):
            raise ValueError(
                f"Provider '{provider_name}' is not enabled in agency-config.json"
            )

        provider_class = ProviderFactory.PROVIDERS[provider_name_lower]
        return provider_class(config, api_key)

    @staticmethod
    def list_available() -> list:
        """List all available provider names"""
        return list(ProviderFactory.PROVIDERS.keys())

    @staticmethod
    def list_enabled(agency_config: dict) -> list:
        """
        List providers that are enabled in config.

        Args:
            agency_config: Full agency-config.json as dict

        Returns:
            List of enabled provider names
        """
        enabled = []
        for provider_name, config in agency_config.get("providers", {}).items():
            if config.get("enabled"):
                enabled.append(provider_name)
        return enabled
