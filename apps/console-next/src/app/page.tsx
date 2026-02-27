"use client";

import { useState } from "react";
import { useSessionsSocket, type SessionData } from "./hooks/use-sessions-socket";
import { StatusBadge } from "./components/status-badge";
import { SessionDetail } from "./components/session-detail";

const ALL_STATUSES = ["all", "active", "on-hold", "transferring", "completed", "failed"];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString();
}

function liveDuration(startedAt: string, endedAt: string | null, durationSeconds: number | null): string {
  if (durationSeconds !== null) {
    const m = Math.floor(durationSeconds / 60);
    const s = durationSeconds % 60;
    return `${m}m ${s}s`;
  }
  if (!endedAt) {
    const seconds = Math.round((Date.now() - new Date(startedAt).getTime()) / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }
  return "--";
}

export default function DashboardPage() {
  const { sessions, connected } = useSessionsSocket();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<SessionData | null>(null);

  const filtered =
    statusFilter === "all"
      ? sessions
      : sessions.filter((s) => s.status === statusFilter);

  const activeCalls = sessions.filter((s) => s.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Voice AI Console
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time call session monitoring
          </p>
          <a
            href="/test-call"
            className="inline-block mt-2 text-sm text-green-400 hover:text-green-300"
          >
            Test call (mic + speaker) →
          </a>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <p className="text-slate-400">Active Calls</p>
            <p className="text-2xl font-bold text-green-400">{activeCalls}</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? "bg-green-400" : "bg-red-400 animate-pulse"
              }`}
            />
            <span className="text-slate-400">
              {connected ? "Connected" : "Reconnecting..."}
            </span>
          </div>
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex gap-2">
        {ALL_STATUSES.map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === status
                ? "bg-slate-700 text-white"
                : "bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {status === "all" ? "All" : status}
            {status === "all" && (
              <span className="ml-1.5 text-slate-500">{sessions.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className={`grid gap-6 ${selected ? "grid-cols-3" : "grid-cols-1"}`}>
        {/* Sessions Table */}
        <div className={selected ? "col-span-2" : "col-span-1"}>
          <div className="rounded-lg border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Caller
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Business
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No sessions found
                    </td>
                  </tr>
                )}
                {filtered.map((session) => (
                  <tr
                    key={session.id}
                    onClick={() => setSelected(session)}
                    className={`cursor-pointer transition-colors hover:bg-slate-800/50 ${
                      selected?.id === session.id ? "bg-slate-800/70" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <StatusBadge status={session.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {session.callerPhone || "--"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {session.businessId.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {formatTime(session.startedAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {liveDuration(session.startedAt, session.endedAt, session.durationSeconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="col-span-1">
            <SessionDetail
              session={selected}
              onClose={() => setSelected(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
