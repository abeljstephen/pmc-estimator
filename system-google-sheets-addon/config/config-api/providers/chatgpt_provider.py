"""
ChatGPT Provider Implementation (Scaffolded)
Uses OpenAI's GPT API
"""

from ..base_provider import BaseProvider, APIResponse


class ChatGPTProvider(BaseProvider):
    """
    ChatGPT API provider implementation (SCAFFOLDED).

    This provider is ready to use when you have an OpenAI API key.

    Setup:
    1. Get API key from https://platform.openai.com/api-keys
    2. Set: export OPENAI_API_KEY="sk-..."
    3. Enable in agency-config.json
    4. Use: python script.py --provider=chatgpt
    """

    def __init__(self, config: dict, api_key: str):
        """Initialize OpenAI client"""
        super().__init__(config, api_key)

        try:
            import openai

            self.client = openai.OpenAI(api_key=api_key)
        except ImportError:
            raise ImportError(
                "OpenAI library not installed. "
                "Install with: pip install openai"
            )

    def call(self, messages: list, system_prompt: str = None, max_tokens: int = None) -> APIResponse:
        """
        Call ChatGPT API.

        Args:
            messages: List of messages
            system_prompt: System message
            max_tokens: Max tokens (uses config default if None)

        Returns:
            APIResponse with ChatGPT response

        Raises:
            ImportError: If openai library not installed
        """
        # Build message list with system prompt if provided
        all_messages = []
        if system_prompt:
            all_messages.append({"role": "system", "content": system_prompt})
        all_messages.extend(messages)

        response = self.client.chat.completions.create(
            model=self.config["model"],
            max_tokens=max_tokens or self.config.get("max_tokens", 4096),
            messages=all_messages,
        )

        input_tokens = response.usage.prompt_tokens
        output_tokens = response.usage.completion_tokens
        cost = self.calculate_cost(input_tokens, output_tokens)

        return APIResponse(
            content=response.choices[0].message.content,
            model=self.config["model"],
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost,
            provider="chatgpt",
        )

    def calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """
        Calculate ChatGPT cost based on current pricing.

        Pricing (as of Feb 2025):
        - GPT-4 Turbo: $10/$30 per MTok
        - GPT-4: $30/$60 per MTok
        - GPT-3.5 Turbo: $0.50/$1.50 per MTok

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
        Test ChatGPT API key validity.

        Makes a minimal API call to verify credentials.

        Returns:
            True if key is valid, False otherwise
        """
        try:
            response = self.client.chat.completions.create(
                model=self.config["model"],
                max_tokens=10,
                messages=[{"role": "user", "content": "test"}],
            )
            return bool(response)
        except Exception as e:
            print(f"ChatGPT API key validation failed: {e}")
            return False
