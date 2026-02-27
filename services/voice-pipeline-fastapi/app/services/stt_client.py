"""Speech-to-Text client interface and mock implementation."""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from typing import AsyncIterator


class STTClient(ABC):
    """Interface for streaming STT providers."""

    @abstractmethod
    async def transcribe_stream(self, audio_chunks: AsyncIterator[bytes]) -> AsyncIterator[str]:
        """Yield partial transcripts as audio is processed."""
        ...


class MockSTTClient(STTClient):
    """Simulates streaming STT with configurable latency."""

    def __init__(self, latency_ms: int = 350) -> None:
        self.latency_ms = latency_ms

    async def transcribe_stream(self, audio_chunks: AsyncIterator[bytes]) -> AsyncIterator[str]:
        """Simulate partial transcript streaming from audio input."""
        mock_partials = [
            "I'd like",
            "I'd like to book",
            "I'd like to book an appointment",
            "I'd like to book an appointment for next Tuesday",
        ]

        async for _chunk in audio_chunks:
            for partial in mock_partials:
                await asyncio.sleep(self.latency_ms / 1000 / len(mock_partials))
                yield partial

            break
