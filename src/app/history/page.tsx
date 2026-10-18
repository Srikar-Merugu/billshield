"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, ReceiptText, Send } from "lucide-react";
import { formatMoney } from "@/lib/check";
import { api } from "@/lib/client";
import { Header } from "@/components/Header";
import { btn } from "@/components/ui";

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
  all_correct: ["Verified", "text-ok border-ok"],
  overcharged: ["Overcharged", "text-bad border-bad"],
  needs_answer: ["Check", "text-ask border-ask"],
  maths_error: ["Doesn't add up", "text-bad border-bad"],
};

export default function History() {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<HistoryRow[]>("/api/history").then(setRows).catch((e: Error) => setError(e.message));
  }, []);

  const sent = rows?.filter((r) => r.sent_at).length ?? 0;
  const found = rows?.filter((r) => r.verdict === "overcharged").length ?? 0;

  return (
    <>
      <Header compact />
      <main className="relative mx-auto -mt-10 w-full max-w-2xl px-4 pb-12">
        <section className="rise rounded-xl border border-line bg-paper p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">My bills</h1>
              <p className="text-sm text-muted">Checked on this device.</p>
            </div>
            <Link href="/" className={`${btn.accent} px-4 py-2.5 text-sm`}>
              <Plus size={16} aria-hidden /> New
            </Link>
          </div>
          {rows && rows.length > 0 && (
            <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
              {[["Checked", rows.length], ["Overcharged", found], ["Messages sent", sent]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-canvas px-2 py-3">
                  <dd className="num text-2xl font-semibold">{v}</dd>
                  <dt className="text-[11px] text-muted">{k}</dt>
                </div>
              ))}
            </dl>
          )}
        </section>

        {error && <p className="mt-4 text-sm text-bad">{error}</p>}
        {rows === null && !error && (
          <div className="mt-3 space-y-3" aria-busy="true" aria-label="Loading bills">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-white/70" />
            ))}
          </div>
        )}
        {rows?.length === 0 && (
          <div role="status" className="mt-3 rounded-xl border border-dashed border-ink/20 bg-paper px-6 py-12 text-center">
            <ReceiptText className="mx-auto text-muted" size={32} aria-hidden />
            <p className="mt-3 font-medium">No bills checked yet</p>
            <p className="mt-1 text-sm text-muted">Upload one and every line gets checked in under a minute.</p>
            <Link href="/" className={`${btn.primary} mt-5`}>Check a bill</Link>
          </div>
        )}

        <ul className="mt-3 space-y-2">
          {rows?.map((r, i) => {
            const [label, cls] = VERDICT[r.verdict] ?? [r.verdict, "text-muted border-line"];
            return (
              <li key={r.id} className="rise" style={{ animationDelay: `${i * 40}ms` }}>
                <a href={`/?bill=${r.id}`} className="group block rounded-xl border border-line bg-paper p-4 transition hover:border-ink/30">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{r.company ?? "Bill"}</p>
                      <p className="num mt-0.5 text-xs text-muted">
                        {r.document_type ?? "bill"}
                        {r.bill_date ? ` · ${r.bill_date.slice(0, 10)}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 -rotate-3 rounded border-2 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${cls}`}>
                      {label}
                    </span>
                    <ChevronRight size={18} className="mt-0.5 shrink-0 text-muted transition group-hover:translate-x-0.5" aria-hidden />
                  </div>
                  {r.message_id && (
                    <p className="mt-3 flex items-start gap-2 rounded-lg bg-canvas px-3 py-2 text-[13px]">
                      <Send size={14} className={`mt-0.5 shrink-0 ${r.sent_at ? "text-ok" : "text-ask"}`} aria-hidden />
                      <span>
                        <b>{r.disputed_line}</b>
                        {r.refund_total ? <span className="num"> · {formatMoney(Number(r.refund_total), r.currency)}</span> : ""}
                        <br />
                        {r.sent_at ? (
                          <span className="text-ok">Sent via {r.sent_where} · {r.words_changed} words changed</span>
                        ) : (
                          <span className="text-ask">Written, not sent yet</span>
                        )}
                      </span>
                    </p>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
