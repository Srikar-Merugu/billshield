"use client";

import { useState } from "react";
import { History, Repeat } from "lucide-react";
import type { BillView } from "@/lib/bills";
import { formatMoney, type CheckedLine } from "@/lib/check";
import { api } from "@/lib/client";
import { MessageCard } from "./MessageCard";
import { btn, Panel, SectionTitle, StatusPill } from "./ui";

export function Result(props: {
  bill: BillView;
  setBill: (b: BillView) => void;
  userName: string;
  setUserName: (s: string) => void;
}) {
  const { bill, setBill } = props;
  const questions = bill.check.lines.filter((l) => l.status === "unexplained");
  return (
    <div className="space-y-3">
      <Verdict bill={bill} />
      {questions.length > 0 && (
        <Panel className="border-ask/30 bg-ask-soft/60">
          <SectionTitle sub="These charges aren't part of what you told us you were promised.">
            Did you agree to {questions.length > 1 ? "these" : "this"}?
          </SectionTitle>
          <div className="space-y-2">
            {questions.map((l) => (
              <Question key={l.index} bill={bill} line={l} setBill={setBill} />
            ))}
          </div>
        </Panel>
      )}
      {bill.check.verdict === "overcharged" && <MessageCard {...props} />}
      <Receipt bill={bill} />
      <EarlierBills bill={bill} />
    </div>
  );
}

function Verdict({ bill }: { bill: BillView }) {
  const { check, currency } = bill;
  const money = (n: number) => formatMoney(n, currency);
  const v = {
    all_correct: { stamp: "Verified", color: "text-ok border-ok", title: "Every line checks out", body: `The lines add up to ${money(check.computedTotal)} and match your promise. Nothing to send.` },
    overcharged: { stamp: "Overcharged", color: "text-bad border-bad", title: `${money(check.refundTotal)} to claim back`, body: check.taxOnOvercharge > 0 ? `${money(check.overchargeBeforeTax)} extra, plus ${money(check.taxOnOvercharge)} tax charged on it.` : "One line doesn't match what you were promised." },
    needs_answer: { stamp: "Check", color: "text-ask border-ask", title: "One thing to confirm", body: "The maths adds up, but a charge isn't in your promise. Did you agree to it?" },
    maths_error: { stamp: "Doesn't add up", color: "text-bad border-bad", title: "The bill's own maths is off", body: "See the receipt below. Check the numbers were read correctly first." },
  }[check.verdict];

  return (
    <section className="rise relative overflow-hidden rounded-xl bg-ink p-5 text-white sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="num min-w-0 pt-1 text-[11px] uppercase leading-relaxed tracking-[0.16em] text-white/50">
          {bill.company ?? "Your bill"}
          {bill.billDate && <span className="block">{bill.billDate}</span>}
        </p>
        <span
          className={`stamp shrink-0 rounded-md border-[3px] bg-paper px-2.5 py-1 text-[13px] font-black uppercase tracking-wider ${v.color}`}
          aria-hidden
        >
          {v.stamp}
        </span>
      </div>
      <h2 className="mt-4 text-[28px] font-bold leading-tight tracking-tight sm:text-4xl">{v.title}</h2>
      <p className="mt-2 max-w-md text-sm text-white/70">{v.body}</p>
    </section>
  );
}

function Question({ bill, line, setBill }: { bill: BillView; line: CheckedLine; setBill: (b: BillView) => void }) {
  const [busy, setBusy] = useState(false);
  async function answer(a: "agreed" | "disputed") {
    setBusy(true);
    try {
      setBill(
        await api<BillView>(`/api/bills/${bill.id}/answer`, {
          method: "POST",
          body: JSON.stringify({ lineId: bill.lineViews[line.index].id, answer: a }),
        }),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-lg border border-line bg-white p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium">{line.label}</p>
        <p className="num shrink-0 font-semibold">{formatMoney(line.amount, bill.currency)}</p>
      </div>
      {bill.lineViews[line.index]?.plainWords && (
        <p className="mt-0.5 text-sm text-muted">{bill.lineViews[line.index].plainWords}</p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button disabled={busy} onClick={() => answer("agreed")} className={`${btn.ghost} py-2.5`}>Yes, I did</button>
        <button disabled={busy} onClick={() => answer("disputed")} className={`${btn.danger} py-2.5`}>No, never</button>
      </div>
    </div>
  );
}

function Receipt({ bill }: { bill: BillView }) {
  const { check, currency } = bill;
  const money = (n: number) => formatMoney(n, currency);
  return (
    <section className="rise receipt-edge rounded-t-xl border border-b-0 border-line bg-paper px-4 pt-5 sm:px-6">
      <div className="mb-4 flex items-end justify-between gap-3 border-b border-dashed border-line pb-4">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight">Every line, checked</h2>
          <p className="text-sm text-muted">Promise: {bill.promiseSummary}</p>
        </div>
        <span className="num shrink-0 rounded bg-ink px-2 py-1 text-[10px] uppercase tracking-wider text-white">Maths by code</span>
      </div>

      <ul className="space-y-4">
        {check.lines.map((l) => (
          <li key={l.index}>
            <div className="flex items-baseline gap-2">
              <span className="font-medium">
                {l.label}
                {l.kind === "tax" && <span className="ml-1 text-xs font-normal text-muted">tax</span>}
                {l.kind === "discount" && <span className="ml-1 text-xs font-normal text-muted">discount</span>}
              </span>
              <span className="leader" aria-hidden />
              <span className={`num shrink-0 font-semibold ${l.status === "wrong" || l.status === "disputed" ? "text-bad" : ""}`}>
                {l.kind === "discount" ? "−" : ""}
                {money(l.amount)}
              </span>
            </div>
            <div className="mt-1 flex items-start justify-between gap-3">
              <p className="text-[13px] leading-snug text-muted">
                {bill.lineViews[l.index]?.plainWords}
                {l.status === "wrong" && l.promisedAmount !== null && (
                  <span className="mt-1 block font-medium text-bad">
                    Promised {money(l.promisedAmount)} · {money(l.difference)} extra
                  </span>
                )}
                {(bill.lineViews[l.index]?.seenBefore ?? 0) > 0 && (
                  <span className="mt-1 flex items-center gap-1 font-medium text-ask">
                    <Repeat size={12} aria-hidden /> Also on {bill.lineViews[l.index].seenBefore} earlier bill(s)
                  </span>
                )}
              </p>
              <StatusPill status={l.status} />
            </div>
          </li>
        ))}
      </ul>

      <dl className="num mt-6 space-y-1.5 border-t border-dashed border-line pt-4 text-sm">
        <Row k="Charges" v={money(check.chargesTotal)} />
        {check.taxTotal > 0 && (
          <Row k={check.taxMode === "included_in_prices" ? "Tax (inside prices)" : "Tax added"} v={money(check.taxTotal)} />
        )}
        {check.taxChecks.map((t, i) => (
          <Row key={i} k={`${t.label}: ${money(t.base)} × ${t.rate}%`} v={`${money(t.expected)} ${t.ok ? "✓" : "✗"}`} muted />
        ))}
        <Row k="Lines add up to" v={money(check.computedTotal)} strong />
        {check.printedTotal !== null && (
          <Row k="Bill says" v={`${money(check.printedTotal)} ${check.totalMatches ? "✓" : "✗"}`} strong />
        )}
        {check.overchargeBeforeTax > 0 && (
          <div className="!mt-4 rounded-lg bg-bad-soft p-3 text-bad">
            <Row k="Overcharged" v={money(check.overchargeBeforeTax)} />
            {check.taxOnOvercharge > 0 && (
              <Row k={`Tax on it (${(check.effectiveTaxRate * 100).toFixed(0)}%)`} v={money(check.taxOnOvercharge)} />
            )}
            <Row k="Refund to ask for" v={money(check.refundTotal)} strong />
          </div>
        )}
      </dl>
    </section>
  );
}

function Row({ k, v, strong, muted }: { k: string; v: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "text-[15px] font-semibold" : ""} ${muted ? "text-xs text-muted" : ""}`}>
      <dt>{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

function EarlierBills({ bill }: { bill: BillView }) {
  const history = bill.printedHistory;
  if (history.length === 0 && !bill.promiseChangedFrom) return null;
  const current = bill.check.printedTotal ?? bill.check.computedTotal;
  // Oldest first when every period is a readable month ("Jun 2026"); otherwise keep the printed order.
  const sorted = history.every((h) => !Number.isNaN(Date.parse(`1 ${h.period}`)))
    ? [...history].sort((a, b) => Date.parse(`1 ${a.period}`) - Date.parse(`1 ${b.period}`))
    : history;
  const bars = sorted.some((h) => Math.abs(h.amount - current) < 0.01)
    ? sorted
    : [...sorted, { period: "This bill", amount: current }];
  const max = Math.max(...bars.map((b) => b.amount), 1);
  const currentIdx = bars.length - 1 - [...bars].reverse().findIndex((b) => Math.abs(b.amount - current) < 0.01);
  return (
    <Panel>
      <SectionTitle sub="From the history printed on your bill.">
        <span className="inline-flex items-center gap-2"><History size={16} aria-hidden /> Earlier bills</span>
      </SectionTitle>
      {bill.promiseChangedFrom && (
        <p className="mb-4 rounded-lg bg-canvas p-3 text-sm">
          Your promise changed from <b>{bill.promiseChangedFrom}</b> to <b>{bill.promiseSummary}</b>.
        </p>
      )}
      {bars.length > 0 && (
        <div className="flex h-36 items-end gap-2" role="img" aria-label={bars.map((b) => `${b.period}: ${formatMoney(b.amount, bill.currency)}`).join(", ")}>
          {bars.map((b, i) => {
            const isCurrent = i === currentIdx;
            return (
              <div key={`${b.period}-${i}`} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="num text-[10px] text-muted">{Math.round(b.amount).toLocaleString("en-IN")}</span>
                <div
                  className={`w-full rounded-t ${isCurrent ? "bg-accent" : "bg-ink/15"}`}
                  style={{ height: `${Math.max(6, (b.amount / max) * 96)}px` }}
                />
                <span className="text-[11px] text-muted">{b.period}</span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
