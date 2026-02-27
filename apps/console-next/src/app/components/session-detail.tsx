"use client";

import type { SessionData } from "../hooks/use-sessions-socket";
import { StatusBadge } from "./status-badge";

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function SessionDetail({
  session,
  onClose,
}: {
  session: SessionData;
  onClose: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Session Detail</h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 text-sm"
        >
          Close
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-slate-500">Session ID</p>
          <p className="font-mono text-xs">{session.id}</p>
        </div>
        <div>
          <p className="text-slate-500">Status</p>
          <StatusBadge status={session.status} />
        </div>
        <div>
          <p className="text-slate-500">Caller</p>
          <p>{session.callerPhone || "--"}</p>
        </div>
        <div>
          <p className="text-slate-500">Business ID</p>
          <p className="font-mono text-xs">{session.businessId}</p>
        </div>
        <div>
          <p className="text-slate-500">Started</p>
          <p>{new Date(session.startedAt).toLocaleTimeString()}</p>
        </div>
        <div>
          <p className="text-slate-500">Duration</p>
          <p>{formatDuration(session.durationSeconds)}</p>
        </div>
        {session.outcome && (
          <div>
            <p className="text-slate-500">Outcome</p>
            <p>{session.outcome.replace(/_/g, " ")}</p>
          </div>
        )}
        {session.summary && (
          <div className="col-span-2">
            <p className="text-slate-500">Summary</p>
            <p className="text-slate-300">{session.summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}
