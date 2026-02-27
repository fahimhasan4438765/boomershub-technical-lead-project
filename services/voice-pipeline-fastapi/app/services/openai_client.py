"""Real OpenAI LLM client. Uses PIPELINE_LLM_API_KEY and PIPELINE_LLM_MODEL."""

from __future__ import annotations

import logging
from typing import AsyncIterator

from app.core.config import settings
from app.services.llm_client import LLMClient

logger = logging.getLogger(__name__)


class OpenAILLMClient(LLMClient):
    """Production OpenAI streaming chat client."""

    def __init__(self, timeout_seconds: float = 30.0) -> None:
        self.timeout_seconds = timeout_seconds
        self._api_key = (settings.llm_api_key or "").strip()
        self._model = (settings.llm_model or "gpt-4o-mini").strip()

    async def generate_stream(
        self,
        transcript: str,
        conversation_history: list[dict[str, str]],
        system_prompt: str,
    ) -> AsyncIterator[str]:
        if not self._api_key:
            raise ValueError("OpenAI API key not configured (PIPELINE_LLM_API_KEY)")

        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=self._api_key)
        messages = [{"role": "system", "content": system_prompt}]
        for msg in conversation_history:
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": transcript})

        try:
            stream = await client.chat.completions.create(
                model=self._model,
                messages=messages,
                stream=True,
                timeout=float(self.timeout_seconds),
            )
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            logger.exception("OpenAI LLM error (no API key in logs)")
            raise
