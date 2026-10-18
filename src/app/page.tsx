"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BillView, MessageView } from "@/lib/bills";
import { formatMoney, type CheckedLine } from "@/lib/check";
import { api, prepareFile } from "@/lib/client";

type Stage = "form" | "reading" | "result";

export default function Home() {
  const [stage, setStage] = useState<Stage>("form");
  const [bill, setBill] = useState<BillView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState("");

  // Opening a saved bill from "My bills" (/?bill=<id>)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("bill");
    if (!id) return;
    setStage("reading");
    api<BillView>(`/api/bills/${id}`)
      .then((view) => {
        setBill(view);
        setStage("result");
      })
      .catch((e: Error) => {
        setError(e.message);
        setStage("form");
      });
  }, []);

  async function analyze(form: FormData) {
    setError(null);
    setStage("reading");
    try {
      const view = await api<BillView>("/api/analyze", { method: "POST", body: form });
      setBill(view);
      setStage("result");
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError((e as Error).message);
      setStage("form");
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:pt-10">
      <header className="mb-6 flex items-center justify-between gap-3">
        <button onClick={() => { setStage("form"); setBill(null); }} className="text-left">
          <span className="block text-2xl font-extrabold tracking-tight text-brand">
            Bill<span className="text-ink">Shield</span>
          </span>
          <span className="block text-sm text-slate-500">Find the charge that doesn&apos;t add up. Send one message.</span>
        </button>
        <Link href="/history" className="shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium">
          My bills
        </Link>
      </header>

      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">
          {error}
        </p>
      )}

      {stage === "form" && <UploadForm onSubmit={analyze} userName={userName} setUserName={setUserName} />}
      {stage === "reading" && <Reading />}
      {stage === "result" && bill && (
        <Result bill={bill} setBill={setBill} userName={userName} setUserName={setUserName} />
      )}
    </main>
  );
}

/* ---------------- Step 1: upload ---------------- */

function UploadForm({
  onSubmit,
  userName,
  setUserName,
}: {
  onSubmit: (f: FormData) => void;
  userName: string;
  setUserName: (s: string) => void;
}) {
  const [billFile, setBillFile] = useState<File | null>(null);
  const [promiseFile, setPromiseFile] = useState<File | null>(null);
  const [promiseText, setPromiseText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!billFile) return;
    setBusy(true);
    const form = new FormData();
    form.set("bill", await prepareFile(billFile));
    if (promiseFile) form.set("promisePhoto", await prepareFile(promiseFile));
    form.set("promiseText", promiseText);
    setBusy(false);
    onSubmit(form);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Card>
        <Step n={1} title="Your bill" hint="Photo, screenshot or PDF of a phone, internet, electricity, card bill or a shop receipt." />
        <FilePick file={billFile} onPick={setBillFile} label="Add bill" required />
      </Card>

      <Card>
        <Step n={2} title="What were you promised?" hint="The plan price, offer or rate you agreed to. Code checks every line against this." />
        <textarea
          value={promiseText}
          onChange={(e) => setPromiseText(e.target.value)}
          rows={3}
          placeholder={"e.g. “My plan is ₹499 a month, nothing else”\nor “Box says offer price ₹1,299”"}
          className="w-full rounded-xl border border-slate-300 bg-white p-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <p className="mt-3 text-sm text-slate-600">Promise printed somewhere? Add a photo (optional):</p>
        <FilePick file={promiseFile} onPick={setPromiseFile} label="Add promise photo" small />
      </Card>

      <Card>
        <Step n={3} title="Your first name" hint="Optional. Used to sign the message. Never stored with your bill." />
        <input
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="e.g. Aditya"
          className="w-full rounded-xl border border-slate-300 bg-white p-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </Card>

      <button
        type="submit"
        disabled={!billFile || (!promiseText.trim() && !promiseFile) || busy}
        className="w-full rounded-2xl bg-brand px-5 py-4 text-lg font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        Check my bill
      </button>
      <p className="text-center text-xs text-slate-500">
        Names, phone and account numbers are hidden before anything is saved.
      </p>
    </form>
  );
}

function FilePick({
  file,
  onPick,
  label,
  required,
  small,
}: {
  file: File | null;
  onPick: (f: File | null) => void;
  label: string;
  required?: boolean;
  small?: boolean;
}) {
  return (
    <label
      className={`mt-2 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed ${
        file ? "border-ok/50 bg-ok-soft" : "border-slate-300 bg-slate-50"
      } ${small ? "p-3" : "p-5"}`}
    >
      <span className="text-2xl" aria-hidden>{file ? "✅" : "📄"}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{file ? file.name : label}</span>
        <span className="block text-xs text-slate-500">{file ? "Tap to change" : "Tap to choose or take a photo"}</span>
      </span>
      <input
        type="file"
        accept="image/*,application/pdf"
        required={required}
        className="sr-only"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function Reading() {
  const steps = ["Reading every line…", "Checking the maths…", "Comparing with your promise…"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 9000);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <Card>
      <div className="flex flex-col items-center gap-4 py-10 text-center" aria-live="polite">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand/20 border-t-brand" />
        <p className="text-lg font-semibold">{steps[i]}</p>
        <p className="text-sm text-slate-500">This takes about 20–40 seconds.</p>
      </div>
    </Card>
  );
}

/* ---------------- Step 2: result ---------------- */

function Result({
  bill,
  setBill,
  userName,
  setUserName,
}: {
  bill: BillView;
  setBill: (b: BillView) => void;
  userName: string;
  setUserName: (s: string) => void;
}) {
  const { check, currency } = bill;
  const money = (n: number) => formatMoney(n, currency);
  const questions = check.lines.filter((l) => l.status === "unexplained");

  return (
    <div className="space-y-5">
      <Verdict bill={bill} />

      {questions.length > 0 && (
        <Card tone="ask">
          <h2 className="text-lg font-bold">Quick question{questions.length > 1 ? "s" : ""}</h2>
          <p className="mb-3 text-sm text-slate-600">These charges aren&apos;t in what you told us you were promised.</p>
          <div className="space-y-3">
            {questions.map((l) => (
              <Question key={l.index} bill={bill} line={l} setBill={setBill} />
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-1 text-lg font-bold">Every line, checked</h2>
        <p className="mb-3 text-sm text-slate-500">
          {bill.company ?? "Bill"} {bill.billDate ? `· ${bill.billDate}` : ""} · Promise: {bill.promiseSummary}
        </p>
        <ul className="divide-y divide-slate-100">
          {check.lines.map((l) => (
            <LineRow key={l.index} line={l} bill={bill} />
          ))}
        </ul>
      </Card>

      <MathsCard bill={bill} />

      {(bill.printedHistory.length > 0 || bill.promiseChangedFrom) && (
        <Card>
          <h2 className="mb-2 text-lg font-bold">Earlier bills</h2>
          {bill.promiseChangedFrom && (
            <p className="mb-2 text-sm">
              Your promise changed: before it was <b>{bill.promiseChangedFrom}</b>, now <b>{bill.promiseSummary}</b>.
            </p>
          )}
          {bill.printedHistory.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {bill.printedHistory.map((h) => (
                <span key={h.period} className="tabular rounded-lg bg-slate-100 px-3 py-1.5 text-sm">
                  {h.period}: <b>{money(h.amount)}</b>
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      {(check.verdict === "overcharged") && (
        <MessageCard bill={bill} setBill={setBill} userName={userName} setUserName={setUserName} />
      )}
    </div>
  );
}

function Verdict({ bill }: { bill: BillView }) {
  const { check, currency } = bill;
  const money = (n: number) => formatMoney(n, currency);
  const map = {
    all_correct: {
      tone: "ok" as const,
      icon: "✅",
      title: "Every line checks out",
      body: `The lines add up to ${money(check.computedTotal)} and match what you were promised. No message needed.`,
    },
    overcharged: {
      tone: "bad" as const,
      icon: "⚠️",
      title: `You were overcharged ${money(check.refundTotal)}`,
      body:
        check.taxOnOvercharge > 0
          ? `${money(check.overchargeBeforeTax)} extra, plus ${money(check.taxOnOvercharge)} tax charged on it.`
          : "Below is the line that doesn't match, and a message you can send.",
    },
    needs_answer: {
      tone: "ask" as const,
      icon: "❓",
      title: "One thing to confirm",
      body: "The maths adds up, but there's a charge we can't match to your promise. Did you agree to it?",
    },
    maths_error: {
      tone: "bad" as const,
      icon: "🧮",
      title: "The bill's own maths doesn't add up",
      body: "See the maths below. Check the numbers were read correctly before you complain.",
    },
  }[check.verdict];
  return (
    <Card tone={map.tone}>
      <div className="flex items-start gap-3">
        <span className="text-3xl" aria-hidden>{map.icon}</span>
        <div>
          <h2 className="text-xl font-extrabold">{map.title}</h2>
          <p className="mt-1 text-sm">{map.body}</p>
        </div>
      </div>
    </Card>
  );
}

function LineRow({ line, bill }: { line: CheckedLine; bill: BillView }) {
  const view = bill.lineViews[line.index];
  const money = (n: number) => formatMoney(n, bill.currency);
  const chip = {
    ok: ["OK", "bg-ok-soft text-ok"],
    agreed: ["You agreed", "bg-ok-soft text-ok"],
    wrong: ["Wrong", "bg-bad-soft text-bad"],
    disputed: ["Not agreed", "bg-bad-soft text-bad"],
    unexplained: ["Ask", "bg-ask-soft text-ask"],
  }[line.status];
  const kindLabel = line.kind === "tax" ? "Tax" : line.kind === "discount" ? "Discount" : null;
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            {line.label} {kindLabel && <span className="text-xs text-slate-500">({kindLabel})</span>}
          </p>
          {view?.plainWords && <p className="text-sm text-slate-500">{view.plainWords}</p>}
          {line.status === "wrong" && line.promisedAmount !== null && (
            <p className="mt-1 text-sm font-medium text-bad">
              Promised {money(line.promisedAmount)} → charged {money(line.amount)} = {money(line.difference)} extra
            </p>
          )}
          {view && view.seenBefore > 0 && (
            <p className="mt-1 text-xs font-medium text-ask">Also on {view.seenBefore} earlier bill{view.seenBefore > 1 ? "s" : ""} you checked</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular font-semibold">{line.kind === "discount" ? "−" : ""}{money(line.amount)}</p>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${chip[1]}`}>{chip[0]}</span>
        </div>
      </div>
    </li>
  );
}

function MathsCard({ bill }: { bill: BillView }) {
  const { check, currency } = bill;
  const money = (n: number) => formatMoney(n, currency);
  return (
    <Card>
      <h2 className="mb-1 text-lg font-bold">The maths</h2>
      <p className="mb-3 text-xs text-slate-500">Done by code, not AI. Same bill → same answer, every time.</p>
      <dl className="tabular space-y-1.5 text-sm">
        <Row k="Charges (after discounts)" v={money(check.chargesTotal)} />
        {check.taxTotal > 0 && (
          <Row
            k={check.taxMode === "included_in_prices" ? "Tax (already inside prices)" : "Tax added"}
            v={money(check.taxTotal)}
          />
        )}
        <Row k="Lines add up to" v={money(check.computedTotal)} strong />
        {check.printedTotal !== null && (
          <Row
            k="Bill says"
            v={`${money(check.printedTotal)} ${check.totalMatches ? "✅" : "❌"}`}
            strong
          />
        )}
        {check.taxChecks.map((t, i) => (
          <Row
            key={i}
            k={`${t.label}: ${money(t.base)} × ${t.rate}%`}
            v={`${money(t.expected)} ${t.ok ? "✅" : `❌ bill says ${money(t.printed)}`}`}
          />
        ))}
        {check.overchargeBeforeTax > 0 && (
          <>
            <hr className="my-2 border-slate-200" />
            <Row k="Overcharged" v={money(check.overchargeBeforeTax)} />
            {check.taxOnOvercharge > 0 && (
              <Row k={`Tax on it (${(check.effectiveTaxRate * 100).toFixed(0)}%)`} v={money(check.taxOnOvercharge)} />
            )}
            <Row k="Refund to ask for" v={money(check.refundTotal)} strong />
          </>
        )}
      </dl>
    </Card>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "font-semibold" : ""}`}>
      <dt className="text-slate-600">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

function Question({ bill, line, setBill }: { bill: BillView; line: CheckedLine; setBill: (b: BillView) => void }) {
  const [busy, setBusy] = useState(false);
  async function answer(a: "agreed" | "disputed") {
    setBusy(true);
    try {
      const view = await api<BillView>(`/api/bills/${bill.id}/answer`, {
        method: "POST",
        body: JSON.stringify({ lineId: bill.lineViews[line.index].id, answer: a }),
      });
      setBill(view);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="font-medium">
        Did you agree to <b>{line.label}</b> ({formatMoney(line.amount, bill.currency)})?
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button disabled={busy} onClick={() => answer("agreed")} className="rounded-lg border border-slate-300 py-2 font-medium">
          Yes, I did
        </button>
        <button disabled={busy} onClick={() => answer("disputed")} className="rounded-lg bg-bad py-2 font-semibold text-white">
          No, never
        </button>
      </div>
    </div>
  );
}

/* ---------------- Step 3: the message ---------------- */

function MessageCard({
  bill,
  setBill,
  userName,
  setUserName,
}: {
  bill: BillView;
  setBill: (b: BillView) => void;
  userName: string;
  setUserName: (s: string) => void;
}) {
  const latest: MessageView | undefined = bill.messages[bill.messages.length - 1];
  const [channel, setChannel] = useState<"email" | "chat">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const view = await api<BillView>(`/api/bills/${bill.id}/message`, {
        method: "POST",
        body: JSON.stringify({ channel, userName }),
      });
      setBill(view);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card tone="brand">
      <h2 className="text-lg font-bold">Your message</h2>
      <p className="mb-3 text-sm text-slate-600">
        Every number in it comes from the maths above. Edit anything you like, then send it.
      </p>

      {!latest && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-white p-1">
            {(["email", "chat"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setChannel(c)}
                className={`rounded-lg py-2 text-sm font-semibold ${channel === c ? "bg-brand text-white" : "text-slate-600"}`}
              >
                {c === "email" ? "Email (formal)" : "WhatsApp / chat"}
              </button>
            ))}
          </div>
          {!userName && (
            <input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Your first name (to sign it)"
              className="mb-3 w-full rounded-xl border border-slate-300 bg-white p-3"
            />
          )}
          <button
            onClick={generate}
            disabled={busy}
            className="w-full rounded-xl bg-brand py-3 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Writing…" : "Write my message"}
          </button>
          {error && <p className="mt-2 text-sm text-bad">{error}</p>}
        </>
      )}

      {latest && <SendBox key={latest.id} message={latest} />}
    </Card>
  );
}

function SendBox({ message }: { message: MessageView }) {
  const [text, setText] = useState(message.finalText ?? message.suggestedText);
  const [copied, setCopied] = useState(false);
  const [where, setWhere] = useState("Email");
  const [result, setResult] = useState<number | null>(message.sentAt ? message.wordsChanged : null);
  const [busy, setBusy] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: user can still select the text */
    }
  }

  async function markSent() {
    setBusy(true);
    try {
      const r = await api<{ wordsChanged: number }>(`/api/messages/${message.id}/sent`, {
        method: "POST",
        body: JSON.stringify({ finalText: text, sentWhere: where }),
      });
      setResult(r.wordsChanged);
    } finally {
      setBusy(false);
    }
  }

  if (result !== null) {
    return (
      <div className="rounded-xl bg-white p-4 text-center">
        <p className="text-3xl" aria-hidden>📨</p>
        <p className="mt-1 text-lg font-bold">Marked as sent</p>
        <p className="text-sm text-slate-600">
          You changed <b>{result}</b> word{result === 1 ? "" : "s"} before sending.
        </p>
        <p className="mt-3 text-xs text-slate-500">Saved with the line it disputes, so you can track the reply.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        className="w-full rounded-xl border border-slate-300 bg-white p-3 text-[15px] leading-relaxed"
      />
      <p className="rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-600">
        📎 Attach a photo of the bill{message.channel === "email" ? " (and the promise, e.g. the box or plan page)" : ""} when you send it.
      </p>
      <button onClick={copy} className="w-full rounded-xl border-2 border-brand bg-white py-3 font-semibold text-brand">
        {copied ? "Copied ✓" : "Copy message"}
      </button>
      <div className="rounded-xl bg-white p-3">
        <p className="mb-2 text-sm font-medium">Sent it? Tell us where:</p>
        <div className="flex gap-2">
          <select value={where} onChange={(e) => setWhere(e.target.value)} className="flex-1 rounded-lg border border-slate-300 p-2">
            {["Email", "WhatsApp", "Company app / website", "X (Twitter)", "Other"].map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
          <button onClick={markSent} disabled={busy} className="rounded-lg bg-ok px-4 font-semibold text-white disabled:opacity-50">
            I sent it
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- bits ---------------- */

function Card({ children, tone }: { children: React.ReactNode; tone?: "ok" | "bad" | "ask" | "brand" }) {
  const tones = {
    ok: "border-ok/30 bg-ok-soft",
    bad: "border-bad/30 bg-bad-soft",
    ask: "border-ask/30 bg-ask-soft",
    brand: "border-brand/30 bg-brand-soft",
  };
  return (
    <section className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${tone ? tones[tone] : "border-slate-200 bg-white"}`}>
      {children}
    </section>
  );
}

function Step({ n, title, hint }: { n: number; title: string; hint: string }) {
  return (
    <div className="mb-2 flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{n}</span>
      <div>
        <h2 className="font-bold">{title}</h2>
        <p className="text-sm text-slate-500">{hint}</p>
      </div>
    </div>
  );
}
