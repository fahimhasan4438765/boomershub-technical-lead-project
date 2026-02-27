"use client";

import { useEffect, useRef, useCallback, useState } from "react";

export interface SessionData {
  id: string;
  callerPhone: string;
  businessId: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  outcome: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SessionEvent {
  event: "session.created" | "session.updated" | "session.ended";
  sessionId: string;
  status: string;
  businessId: string;
  updatedAt: string;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001/ws/sessions";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function useSessionsSocket() {
  const [sessions, setSessions] = useState<Map<string, SessionData>>(new Map());
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/sessions?limit=50`);
      if (!res.ok) return;
      const body = (await res.json()) as { data: SessionData[] };
      setSessions((prev) => {
        const next = new Map(prev);
        for (const s of body.data) {
          next.set(s.id, s);
        }
        return next;
      });
    } catch {
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      void fetchSessions();
    };

    ws.onmessage = (evt: MessageEvent) => {
      try {
        const event = JSON.parse(evt.data as string) as SessionEvent;
        setSessions((prev) => {
          const next = new Map(prev);
          const existing = next.get(event.sessionId);
          if (existing) {
            next.set(event.sessionId, {
              ...existing,
              status: event.status,
              updatedAt: event.updatedAt,
            });
          } else {
            next.set(event.sessionId, {
              id: event.sessionId,
              callerPhone: "",
              businessId: event.businessId,
              status: event.status,
              startedAt: event.updatedAt,
              endedAt: null,
              durationSeconds: null,
              outcome: null,
              summary: null,
              createdAt: event.updatedAt,
              updatedAt: event.updatedAt,
            });
            void fetchSessionById(event.sessionId, next);
          }
          return next;
        });
      } catch {
      }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [fetchSessions]);

  const fetchSessionById = async (id: string, current: Map<string, SessionData>) => {
    try {
      const res = await fetch(`${API_URL}/sessions/${id}`);
      if (!res.ok) return;
      const session = (await res.json()) as SessionData;
      setSessions((prev) => {
        const next = new Map(prev);
        next.set(id, session);
        return next;
      });
    } catch {
    }
  };

  useEffect(() => {
    void fetchSessions();
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect, fetchSessions]);

  return {
    sessions: Array.from(sessions.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
    connected,
  };
}
