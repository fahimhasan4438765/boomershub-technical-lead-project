"use client";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  "on-hold": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  transferring: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  completed: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
};

export function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS["completed"];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors}`}
    >
      {status === "active" && (
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
      )}
      {status}
    </span>
  );
}
