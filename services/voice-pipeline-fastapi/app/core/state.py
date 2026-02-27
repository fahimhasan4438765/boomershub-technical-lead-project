"""Per-call pipeline state management."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class PipelineState:
    """State for a single active call."""

    session_id: str
    caller_phone: str
    business_id: str
    is_ai_speaking: bool = False
    partial_transcript: str = ""
    conversation_history: list[dict[str, str]] = field(default_factory=list)
    started_at: float = field(default_factory=time.time)
    interrupted: bool = False
    stream_sid: str = ""
    _audio_buffer: bytearray = field(default_factory=bytearray, repr=False)


class StateStore:
    """In-memory session state store."""

    def __init__(self) -> None:
        self._sessions: dict[str, PipelineState] = {}

    def create(
        self,
        session_id: str,
        caller_phone: str,
        business_id: str,
        stream_sid: str = "",
    ) -> PipelineState:
        state = PipelineState(
            session_id=session_id,
            caller_phone=caller_phone,
            business_id=business_id,
            stream_sid=stream_sid,
        )
        self._sessions[session_id] = state
        return state

    def get(self, session_id: str) -> Optional[PipelineState]:
        return self._sessions.get(session_id)

    def delete(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)

    def set_ai_speaking(self, session_id: str, speaking: bool) -> None:
        state = self._sessions.get(session_id)
        if state:
            state.is_ai_speaking = speaking


state_store = StateStore()
