"""Voice AI pipeline WebSocket endpoint."""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import uuid
from typing import AsyncIterator

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.config import settings
from app.core.state import state_store, PipelineState
from app.services.stt_client import MockSTTClient, STTClient
from app.services.llm_client import MockLLMClient, LLMClient
from app.services.tts_client import MockTTSClient, TTSClient

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_stt_client() -> STTClient:
    if (settings.stt_api_key or "").strip():
        from app.services.deepgram_client import DeepgramSTTClient
        return DeepgramSTTClient(timeout_seconds=settings.stt_timeout_ms / 1000.0 + 5)
    return MockSTTClient(latency_ms=settings.stt_timeout_ms)


def _get_llm_client() -> LLMClient:
    if (settings.llm_api_key or "").strip():
        from app.services.openai_client import OpenAILLMClient
        return OpenAILLMClient(timeout_seconds=settings.llm_timeout_ms / 1000.0 + 10)
    return MockLLMClient(latency_ms=settings.llm_timeout_ms)


def _get_tts_client() -> TTSClient:
    provider = (settings.tts_provider or "").strip().lower()
    if provider == "openai":
        if (settings.tts_api_key or settings.llm_api_key or "").strip():
            from app.services.openai_tts_client import OpenAITTSClient
            return OpenAITTSClient(timeout_seconds=settings.tts_timeout_ms / 1000.0 + 20)
    if provider == "elevenlabs":
        if (settings.tts_api_key or "").strip() and (settings.tts_voice_id or "").strip():
            from app.services.elevenlabs_client import ElevenLabsTTSClient
            return ElevenLabsTTSClient(timeout_seconds=settings.tts_timeout_ms / 1000.0 + 10)
    return MockTTSClient(latency_ms=settings.tts_timeout_ms)


stt_client = _get_stt_client()
llm_client = _get_llm_client()
tts_client = _get_tts_client()


async def _audio_chunk_generator(data: bytes) -> AsyncIterator[bytes]:
    """Wrap a single audio payload as an async iterator for the STT client."""
    yield data


async def _play_greeting(state: PipelineState, websocket: WebSocket) -> None:
    """Play an initial greeting as soon as the call connects (no STT)."""
    try:
        greeting_prompt = (
            "You are a friendly AI receptionist. The caller has just connected. "
            "Say a single short greeting and ask how you can help. Example: "
            "'Hello, thanks for calling. How can I help you today?' Keep it to one sentence."
        )
        state.is_ai_speaking = True
        full_response = ""
        llm_tokens: list[str] = []
        async for token in llm_client.generate_stream(
            transcript="[Call connected]",
            conversation_history=[],
            system_prompt=greeting_prompt,
        ):
            full_response += token
            llm_tokens.append(token)

        state.conversation_history.append({"role": "assistant", "content": full_response})

        async def _token_stream() -> AsyncIterator[str]:
            for t in llm_tokens:
                yield t

        tts_buffer = bytearray()
        async for audio_chunk in tts_client.synthesize_stream(_token_stream()):
            tts_buffer.extend(audio_chunk)

        if state.stream_sid and tts_buffer:
            from app.utils.twilio_audio import pcm_16k_to_mulaw_8k
            mulaw_bytes = pcm_16k_to_mulaw_8k(bytes(tts_buffer))
            if mulaw_bytes:
                payload_b64 = base64.b64encode(mulaw_bytes).decode("ascii")
                await websocket.send_json({
                    "event": "media",
                    "streamSid": state.stream_sid,
                    "media": {"payload": payload_b64},
                })
        elif tts_buffer:
            await websocket.send_bytes(bytes(tts_buffer))

        # Always send the greeting text so browser clients can speak it even if
        # TTS bytes are unavailable (or blocked by provider limits).
        try:
            await websocket.send_json({
                "type": "pipeline.greeting",
                "sessionId": state.session_id,
                "fullResponse": full_response,
            })
        except Exception:
            pass
        state.is_ai_speaking = False
        logger.info("Greeting played for stream %s", state.session_id)
    except Exception as e:
        state.is_ai_speaking = False
        logger.warning("Greeting failed: %s", type(e).__name__)


async def _run_pipeline(
    state: PipelineState,
    audio_data: bytes,
    websocket: WebSocket,
) -> None:
    """Execute the STT → LLM → TTS pipeline for one utterance."""
    try:
        transcript = ""
        async for partial in stt_client.transcribe_stream(_audio_chunk_generator(audio_data)):
            transcript = partial
            await websocket.send_json({
                "type": "stt.partial",
                "sessionId": state.session_id,
                "transcript": partial,
            })

        state.partial_transcript = transcript
        await websocket.send_json({
            "type": "stt.final",
            "sessionId": state.session_id,
            "transcript": transcript,
        })

        if not (transcript or "").strip():
            return

        logger.info("Turn: user said (%d chars) -> running LLM+TTS", len(transcript))

        state.conversation_history.append({"role": "user", "content": transcript})

        state.is_ai_speaking = True
        full_response = ""

        system_prompt = (
            "You are a friendly AI receptionist. Help callers book appointments, "
            "answer questions, and provide information about the business."
        )

        llm_tokens: list[str] = []

        async for token in llm_client.generate_stream(
            transcript=transcript,
            conversation_history=state.conversation_history[:-1],
            system_prompt=system_prompt,
        ):
            if state.interrupted:
                await websocket.send_json({
                    "type": "pipeline.interrupted",
                    "sessionId": state.session_id,
                    "partialResponse": full_response,
                })
                state.is_ai_speaking = False
                state.interrupted = False
                return

            full_response += token
            llm_tokens.append(token)
            await websocket.send_json({
                "type": "llm.token",
                "sessionId": state.session_id,
                "token": token,
            })

        state.conversation_history.append({"role": "assistant", "content": full_response})

        async def _token_stream() -> AsyncIterator[str]:
            for t in llm_tokens:
                yield t

        tts_buffer = bytearray()
        async for audio_chunk in tts_client.synthesize_stream(_token_stream()):
            tts_buffer.extend(audio_chunk)

        if state.stream_sid and tts_buffer:
            from app.utils.twilio_audio import pcm_16k_to_mulaw_8k
            mulaw_bytes = pcm_16k_to_mulaw_8k(bytes(tts_buffer))
            if mulaw_bytes:
                payload_b64 = base64.b64encode(mulaw_bytes).decode("ascii")
                await websocket.send_json({
                    "event": "media",
                    "streamSid": state.stream_sid,
                    "media": {"payload": payload_b64},
                })
        elif tts_buffer and not state.stream_sid:
            await websocket.send_bytes(bytes(tts_buffer))

        state.is_ai_speaking = False
        logger.info("Turn: assistant replied (%d chars)", len(full_response))
        await websocket.send_json({
            "type": "pipeline.turn_complete",
            "sessionId": state.session_id,
            "fullResponse": full_response,
        })
    except Exception as e:
        state.is_ai_speaking = False
        logger.warning(
            "Pipeline error for session %s: %s (%s)",
            state.session_id,
            type(e).__name__,
            str(e)[:300],
            exc_info=settings.debug,
        )
        try:
            await websocket.send_json({
                "type": "pipeline.error",
                "sessionId": state.session_id,
                "message": "Sorry, I'm having trouble. Please try again.",
            })
        except Exception:
            pass


def _decode_twilio_media_payload(message: dict) -> bytes | None:
    """Extract and base64-decode audio from Twilio media message."""
    media = message.get("media") or {}
    payload = media.get("payload")
    if not payload:
        return None
    try:
        return base64.b64decode(payload)
    except Exception:
        return None


@router.websocket("/ws/twilio-audio")
async def twilio_audio_stream(websocket: WebSocket) -> None:
    """Handle a Twilio Media Streams WebSocket."""
    await websocket.accept()
    session_id: str | None = None

    try:
        while True:
            raw = await websocket.receive()
            if raw.get("type") == "websocket.disconnect":
                break

            if "text" in raw:
                message = json.loads(raw["text"])
                event_type = message.get("event", message.get("type", ""))

                if event_type == "connected":
                    logger.debug("Twilio connected")
                    continue

                if event_type == "start":
                    stream_sid = message.get("streamSid") or message.get("sessionId") or "unknown"
                    start_obj = message.get("start") or {}
                    custom = start_obj.get("customParameters") or {}
                    session_id = stream_sid
                    state = state_store.create(
                        session_id=session_id,
                        caller_phone=custom.get("callerPhone", "") or start_obj.get("callSid", ""),
                        business_id=custom.get("businessId", ""),
                        stream_sid=stream_sid,
                    )
                    logger.info("Pipeline started for stream %s", stream_sid)
                    await _play_greeting(state, websocket)
                    continue

                if event_type == "media":
                    if not session_id:
                        continue
                    state = state_store.get(session_id)
                    if not state:
                        continue
                    media = message.get("media") or {}
                    if media.get("track") and media.get("track") != "inbound":
                        continue
                    audio_bytes = _decode_twilio_media_payload(message)
                    if not audio_bytes:
                        continue
                    if state.is_ai_speaking:
                        state.interrupted = True
                        await asyncio.sleep(0.1)
                    state._audio_buffer.extend(audio_bytes)
                    if len(state._audio_buffer) >= 3200:
                        to_process = bytes(state._audio_buffer)
                        state._audio_buffer.clear()
                        await _run_pipeline(state, to_process, websocket)
                    continue

                if event_type == "stop":
                    logger.info("Pipeline stopped for session %s", session_id)
                    if session_id:
                        state_store.delete(session_id)
                    break

            elif "bytes" in raw:
                if not session_id:
                    continue
                state = state_store.get(session_id)
                if not state:
                    continue
                if state.is_ai_speaking:
                    state.interrupted = True
                await _run_pipeline(state, raw["bytes"], websocket)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for session %s", session_id)
    finally:
        if session_id:
            state_store.delete(session_id)


@router.websocket("/ws/test-call")
async def test_call_stream(websocket: WebSocket) -> None:
    """Browser test client: send PCM 16k base64, receive PCM 16k binary. No Twilio."""
    await websocket.accept()
    session_id: str | None = None

    try:
        while True:
            raw = await websocket.receive()
            if raw.get("type") == "websocket.disconnect":
                break

            if "text" in raw:
                message = json.loads(raw["text"])
                event_type = message.get("event", "")

                if event_type == "start":
                    session_id = str(uuid.uuid4())
                    state = state_store.create(
                        session_id=session_id,
                        caller_phone="test-client",
                        business_id="",
                        stream_sid="",
                    )
                    logger.info("Test call started %s", session_id)
                    await _play_greeting(state, websocket)
                    continue

                if event_type == "media":
                    if not session_id:
                        continue
                    state = state_store.get(session_id)
                    if not state:
                        continue
                    payload_b64 = message.get("payload") or (message.get("media") or {}).get("payload")
                    if not payload_b64:
                        continue
                    if state.is_ai_speaking:
                        continue
                    try:
                        pcm_16k = base64.b64decode(payload_b64)
                    except Exception:
                        continue
                    from app.utils.twilio_audio import pcm_16k_to_mulaw_8k
                    mulaw_8k = pcm_16k_to_mulaw_8k(pcm_16k)
                    if not mulaw_8k:
                        continue
                    state._audio_buffer.extend(mulaw_8k)
                    # Buffer longer for browser mic input to improve STT accuracy
                    # and avoid excessive Deepgram calls.
                    if len(state._audio_buffer) >= 16000:
                        to_process = bytes(state._audio_buffer)
                        state._audio_buffer.clear()
                        await _run_pipeline(state, to_process, websocket)
                    continue

                if event_type == "stop":
                    if session_id:
                        state_store.delete(session_id)
                    break

    except WebSocketDisconnect:
        logger.info("Test call disconnected %s", session_id)
    finally:
        if session_id:
            state_store.delete(session_id)
