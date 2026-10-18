import type { ReactNode } from "react";
import { Check, CircleAlert, CircleHelp, X } from "lucide-react";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M16 2 4 6.5v8.2C4 22.3 9.1 28.4 16 30c6.9-1.6 12-7.7 12-15.3V6.5L16 2Z" fill="#f2a516" />
      <path d="m10.5 16.2 3.8 3.8 7.3-7.6" fill="none" stroke="#0e1726" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rise rounded-xl border border-line bg-paper p-4 sm:p-6 ${className}`}>{children}</section>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="text-[17px] font-semibold tracking-tight">{children}</h2>
      {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
    </div>
  );
}

type Status = "ok" | "agreed" | "wrong" | "disputed" | "unexplained";

const STATUS: Record<Status, { label: string; cls: string; Icon: typeof Check }> = {
  ok: { label: "OK", cls: "bg-ok-soft text-ok", Icon: Check },
  agreed: { label: "You agreed", cls: "bg-ok-soft text-ok", Icon: Check },
  wrong: { label: "Wrong", cls: "bg-bad-soft text-bad", Icon: CircleAlert },
  disputed: { label: "Not agreed", cls: "bg-bad-soft text-bad", Icon: X },
  unexplained: { label: "Check", cls: "bg-ask-soft text-ask", Icon: CircleHelp },
};

export function StatusPill({ status }: { status: Status }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>
      <s.Icon size={12} strokeWidth={2.5} aria-hidden />
      {s.label}
    </span>
  );
}

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-5 py-3.5 font-semibold text-white transition hover:bg-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40",
  accent:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3.5 font-semibold text-accent-ink transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-bad px-5 py-3.5 font-semibold text-white transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-40",
  success:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-ok px-5 py-3.5 font-semibold text-white transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-40",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-3 font-medium text-ink transition hover:border-ink/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40",
};

export const field =
  "w-full rounded-lg border border-line bg-white px-3.5 py-3 text-base text-ink placeholder:text-muted/70 outline-none transition focus:border-ink/40 focus:ring-4 focus:ring-accent/20";
