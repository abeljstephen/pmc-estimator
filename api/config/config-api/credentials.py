"""
Credentials Manager
Manages API keys securely from environment variables
"""

import os
from typing import Optional


class CredentialsManager:
    """
    Secure credential management.

    All API keys are stored in environment variables, never in code or config files.
    This manager retrieves them as needed.
    """

    def __init__(self, config: dict):
        """
        Initialize credentials manager.

        Args:
            config: agency-config.json as dict
        """
        self.config = config
        self._cache = {}

    def get(self, provider_name: str) -> str:
        """
        Get API key for a provider from environment.

        Args:
            provider_name: Name of provider ("claude", "chatgpt", "grok")

        Returns:
            API key string

        Raises:
            ValueError: If API key not found in environment
        """
        provider_name_lower = provider_name.lower()

        # Check cache first
        if provider_name_lower in self._cache:
            return self._cache[provider_name_lower]

        # Get env var name from config
        if provider_name_lower not in self.config.get("providers", {}):
            raise ValueError(f"Provider '{provider_name}' not found in config")

        env_var = self.config["providers"][provider_name_lower].get("api_key_env_var")

        if not env_var:
            raise ValueError(
                f"No api_key_env_var configured for provider '{provider_name}'"
            )

        # Get from environment
        api_key = os.environ.get(env_var)

        if not api_key:
            raise ValueError(
                f"API key for {provider_name} not found. "
                f"Set environment variable: {env_var}\n"
                f"Example: export {env_var}='your-api-key'"
            )

        # Cache it
        self._cache[provider_name_lower] = api_key

        return api_key

    def validate_all(self) -> dict:
        """
        Check which enabled providers have valid API keys.

        Returns:
            Dict mapping provider name -> (has_key: bool, error: Optional[str])
        """
        results = {}

        for provider_name, config in self.config.get("providers", {}).items():
            if not config.get("enabled"):
                results[provider_name] = {"available": False, "reason": "disabled"}
                continue

            env_var = config.get("api_key_env_var")

            if not env_var:
                results[provider_name] = {
                    "available": False,
                    "reason": "no env_var configured",
                }
                continue

            api_key_exists = bool(os.environ.get(env_var))

            results[provider_name] = {
                "available": api_key_exists,
                "env_var": env_var,
                "reason": "ready" if api_key_exists else f"set {env_var}",
            }

        return results

    def print_status(self) -> None:
        """Print credential status for all providers"""
        print("\n" + "=" * 70)
        print("CREDENTIAL STATUS")
        print("=" * 70)

        status = self.validate_all()

        for provider_name, info in status.items():
            if info["available"]:
                print(f"✓ {provider_name:15} - Ready")
            else:
                reason = info.get("reason", "unknown")
                print(f"✗ {provider_name:15} - {reason}")

        print("=" * 70 + "\n")
