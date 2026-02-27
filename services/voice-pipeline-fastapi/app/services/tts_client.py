"""Text-to-Speech client interface and mock implementation."""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from typing import AsyncIterator


class TTSClient(ABC):
    """Interface for streaming TTS providers."""

    @abstractmethod
    async def synthesize_stream(self, text_chunks: AsyncIterator[str]) -> AsyncIterator[bytes]:
        """Yield audio chunks as text is synthesized."""
        ...


class MockTTSClient(TTSClient):
    """Simulates streaming TTS with early start."""

    def __init__(self, latency_ms: int = 300) -> None:
        self.latency_ms = latency_ms

    async def synthesize_stream(self, text_chunks: AsyncIterator[str]) -> AsyncIterator[bytes]:
        """Simulate audio chunk generation from text input."""
        buffer = ""
        first_chunk = True

        async for text in text_chunks:
            buffer += text

            if any(buffer.endswith(c) for c in ".!?,") or len(buffer) > 50:
                if first_chunk:
                    await asyncio.sleep(self.latency_ms / 1000)
                    first_chunk = False
                else:
                    await asyncio.sleep(0.05)

                yield f"[audio:{buffer.strip()}]".encode("utf-8")
                buffer = ""

        if buffer.strip():
            yield f"[audio:{buffer.strip()}]".encode("utf-8")
