from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

@dataclass
class APIResponse:
    """Unified response format across all providers"""
    content: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    provider: str


class BaseProvider(ABC):
    """
    Abstract base for all LLM providers.
    All providers must implement this interface.
    Ensures consistent behavior across Claude, ChatGPT, Grok, etc.
    """

    def __init__(self, config: dict, api_key: str):
        """
        Initialize provider.

        Args:
            config: Provider-specific config from agency-config.json
            api_key: API key from environment variable
        """
        self.config = config
        self.api_key = api_key
        self.provider_name = self.__class__.__name__

    @abstractmethod
    def call(
        self,
        messages: list,
        system_prompt: Optional[str] = None,
        max_tokens: Optional[int] = None
    ) -> APIResponse:
        """
        Make API call and return unified response.

        Args:
            messages: List of messages in format: [{"role": "user", "content": "..."}]
            system_prompt: Optional system message
            max_tokens: Max tokens in response

        Returns:
            APIResponse with standardized fields
        """
        pass

    @abstractmethod
    def calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """
        Calculate cost in USD based on pricing in config.

        Args:
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens

        Returns:
            Cost in USD (float)
        """
        pass

    @abstractmethod
    def validate_api_key(self) -> bool:
        """
        Verify API key is valid by making a test call.

        Returns:
            True if valid, False otherwise
        """
        pass

    def get_provider_name(self) -> str:
        """Get human-readable provider name"""
        return self.config.get("name", self.provider_name)
