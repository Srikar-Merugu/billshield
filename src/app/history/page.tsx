"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/check";
import { api } from "@/lib/client";

interface HistoryRow {
  id: string;
  company: string | null;
  document_type: string | null;
  bill_date: string | null;
  currency: string;
  verdict: string;
  created_at: string;
  promise: string | null;
  message_id: string | null;
  sent_at: string | null;
  words_changed: number | null;
  refund_total: string | null;
  sent_where: string | null;
  disputed_line: string | null;
}

const VERDICT: Record<string, [string, string]> = {
  all_correct: ["All correct", "bg-ok-soft text-ok"],
  overcharged: ["Overcharged", "bg-bad-soft text-bad"],
  needs_answer: ["Needs your answer", "bg-ask-soft text-ask"],
  maths_error: ["Maths error", "bg-bad-soft text-bad"],
};

export default function History() {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<HistoryRow[]>("/api/history").then(setRows).catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:pt-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">My bills</h1>
          <p className="text-sm text-slate-500">Bills checked on this device, and the messages you sent.</p>
        </div>
        <Link href="/" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white">
          + New
        </Link>
      </header>

      {error && <p className="text-bad">{error}</p>}
      {rows === null && !error && <p className="text-slate-500">Loading…</p>}
      {rows?.length === 0 && <p className="text-slate-500">No bills yet.</p>}

      <ul className="space-y-3">
        {rows?.map((r) => {
          const [label, cls] = VERDICT[r.verdict] ?? [r.verdict, "bg-slate-100"];
          return (
            <li key={r.id}>
              <a href={`/?bill=${r.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{r.company ?? "Bill"}</p>
                    <p className="text-sm text-slate-500">
                      {r.document_type ?? ""} {r.bill_date ? `· ${r.bill_date.slice(0, 10)}` : ""}
                    </p>
                    {r.promise && <p className="text-sm text-slate-500">Promise: {r.promise}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{label}</span>
                </div>
                {r.message_id && (
                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    Message about <b>{r.disputed_line}</b>
                    {r.refund_total ? ` (refund ${formatMoney(Number(r.refund_total), r.currency)})` : ""}:{" "}
                    {r.sent_at ? (
                      <span className="font-semibold text-ok">
                        sent via {r.sent_where}, {r.words_changed} words changed
                      </span>
                    ) : (
                      <span className="text-ask">written, not sent yet</span>
                    )}
                  </p>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
