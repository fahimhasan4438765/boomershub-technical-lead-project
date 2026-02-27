"""LLM client interface and mock implementation."""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from typing import AsyncIterator


class LLMClient(ABC):
    """Interface for streaming LLM providers."""

    @abstractmethod
    async def generate_stream(
        self,
        transcript: str,
        conversation_history: list[dict[str, str]],
        system_prompt: str,
    ) -> AsyncIterator[str]:
        """Yield response tokens as they are generated."""
        ...


class MockLLMClient(LLMClient):
    """Simulates token-level LLM streaming."""

    def __init__(self, latency_ms: int = 450) -> None:
        self.latency_ms = latency_ms

    async def generate_stream(
        self,
        transcript: str,
        conversation_history: list[dict[str, str]],
        system_prompt: str,
    ) -> AsyncIterator[str]:
        """Simulate token-by-token LLM response."""
        await asyncio.sleep(self.latency_ms / 1000)

        mock_response_tokens = [
            "Of", " course!", " I'd", " be", " happy", " to", " help",
            " you", " book", " an", " appointment.", " We", " have",
            " availability", " next", " Tuesday", " at", " 2pm", " and", " 4pm.",
            " Which", " time", " works", " better", " for", " you?",
        ]

        for token in mock_response_tokens:
            await asyncio.sleep(0.02)
            yield token
