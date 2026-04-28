"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";

const PIPELINE_WS =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_PIPELINE_WS_URL || "ws://localhost:8001/ws/test-call")
    : "";

export default function TestCallPage() {
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [transcript, setTranscript] = useState<string>("");
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const speakingRef = useRef(false);
  const receivedBinaryAudioRef = useRef(false);

  const stopCall = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.send(JSON.stringify({ event: "stop" }));
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    if (processorRef.current && sourceRef.current) {
      try {
        sourceRef.current.disconnect();
        processorRef.current.disconnect();
      } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    speakingRef.current = false;
    receivedBinaryAudioRef.current = false;
    setStatus("idle");
    setTranscript("");
  }, []);

  const startCall = useCallback(async () => {
    setStatus("connecting");
    setTranscript("");
    receivedBinaryAudioRef.current = false;

    const ws = new WebSocket(PIPELINE_WS);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = async () => {
      ws.send(JSON.stringify({ event: "start" }));

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        streamRef.current = stream;

        const sampleRate = 16000;
        const ctx = new AudioContext({ sampleRate });
        audioContextRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        sourceRef.current = source;

        const bufferSize = 2048;
        const processor = ctx.createScriptProcessor(bufferSize, 1, 1);
        processorRef.current = processor;

        let inputSampleRate = ctx.sampleRate;
        const downsample = Math.max(1, Math.round(inputSampleRate / sampleRate));

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          if (speakingRef.current) return;
          const input = e.inputBuffer.getChannelData(0);
          const outLength = Math.floor(input.length / downsample);
          const out = new Int16Array(outLength);
          for (let i = 0; i < outLength; i++) {
            const s = input[i * downsample];
            out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          const bytes = new Uint8Array(out.buffer);
          let binary = "";
          const chunk = 8192;
          for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
          }
          ws.send(JSON.stringify({ event: "media", payload: btoa(binary) }));
        };

        source.connect(processor);
        const silentGain = ctx.createGain();
        silentGain.gain.value = 0;
        processor.connect(silentGain);
        silentGain.connect(ctx.destination);
        setStatus("connected");
      } catch (err) {
        setStatus("error");
        setTranscript("Could not access microphone.");
        ws.close();
      }
    };

    const playPcm16k = (data: ArrayBuffer) => {
      const ctx = audioContextRef.current;
      if (!ctx) return;
      if (!data.byteLength) return;
      const numSamples = data.byteLength / 2;
      if (numSamples <= 0) return;
      const buffer = ctx.createBuffer(1, numSamples, 16000);
      const channel = buffer.getChannelData(0);
      const view = new Int16Array(data);
      for (let i = 0; i < numSamples; i++) {
        channel[i] = view[i] / (view[i] < 0 ? 0x8000 : 0x7fff);
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      speakingRef.current = true;
      src.onended = () => {
        speakingRef.current = false;
      };
      src.start();
    };

    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data);
          if (msg.transcript) setTranscript((t) => t + " " + msg.transcript);
          if (msg.fullResponse) {
            setTranscript((t) => t + "\n→ " + msg.fullResponse);

            // In mock mode the backend may not stream playable audio bytes.
            // Use the browser's built-in speech synthesis so you can still
            // "hear" the agent without external TTS keys.
            if (
              !receivedBinaryAudioRef.current &&
              typeof window !== "undefined" &&
              "speechSynthesis" in window
            ) {
              try {
                window.speechSynthesis.cancel();
                const u = new SpeechSynthesisUtterance(String(msg.fullResponse));
                u.rate = 1;
                u.pitch = 1;
                u.volume = 1;
                speakingRef.current = true;
                u.onend = () => {
                  speakingRef.current = false;
                };
                u.onerror = () => {
                  speakingRef.current = false;
                };
                window.speechSynthesis.speak(u);
              } catch {}
            }
          }
        } catch {}
        return;
      }
      if (event.data instanceof ArrayBuffer) {
        receivedBinaryAudioRef.current = true;
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        playPcm16k(event.data);
        return;
      }
      if (typeof Blob !== "undefined" && event.data instanceof Blob) {
        receivedBinaryAudioRef.current = true;
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        void event.data
          .arrayBuffer()
          .then(playPcm16k)
          .catch(() => {});
      }
    };

    ws.onerror = () => setStatus("error");
    ws.onclose = () => {
      wsRef.current = null;
      if (status === "connected") stopCall();
    };
  }, [status, stopCall]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-slate-400 hover:text-slate-200 text-sm"
        >
          ← Back to Console
        </Link>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Test Call (Desktop Mic &amp; Speaker)
      </h1>
      <p className="text-slate-400 max-w-xl">
        Talk using your microphone; the AI will respond through your speakers.
        No phone or Twilio needed. Make sure the Voice Pipeline is running on
        port 8001.
      </p>

      <div className="flex gap-4">
        {status !== "connected" ? (
          <button
            onClick={startCall}
            disabled={status === "connecting"}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
          >
            {status === "connecting" ? "Connecting…" : "Start call"}
          </button>
        ) : (
          <button
            onClick={stopCall}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
          >
            End call
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span
          className={`h-2 w-2 rounded-full ${
            status === "connected"
              ? "bg-green-400"
              : status === "error"
                ? "bg-red-400"
                : "bg-slate-500"
          }`}
        />
        <span className="text-slate-400">
          {status === "idle" && "Ready"}
          {status === "connecting" && "Connecting…"}
          {status === "connected" && "Connected — speak now"}
          {status === "error" && "Error — check mic and pipeline"}
        </span>
      </div>

      {transcript && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-200 whitespace-pre-wrap">
          {transcript}
        </div>
      )}
    </div>
  );
}
