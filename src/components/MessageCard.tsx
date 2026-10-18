"use client";

import { useState } from "react";
import { Check, Copy, Mail, MessageCircle, Paperclip, PenLine, Send, Sparkles } from "lucide-react";
import type { BillView, MessageView } from "@/lib/bills";
import { api } from "@/lib/client";
import { btn, field } from "./ui";

export function MessageCard({
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
      setBill(await api<BillView>(`/api/bills/${bill.id}/message`, { method: "POST", body: JSON.stringify({ channel, userName }) }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rise rounded-xl border-2 border-ink bg-white p-4 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-ink">
          <Send size={18} aria-hidden />
        </span>
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight">Your message</h2>
          <p className="text-sm text-muted">AI writes the words. Every number comes from the maths below.</p>
        </div>
      </div>

      {!latest ? (
        <div className="space-y-3">
          <div role="radiogroup" aria-label="Where will you send it?" className="grid grid-cols-2 gap-1 rounded-lg bg-canvas p-1">
            {([["email", "Email", Mail], ["chat", "WhatsApp / chat", MessageCircle]] as const).map(([c, label, Icon]) => (
              <button
                key={c}
                role="radio"
                aria-checked={channel === c}
                onClick={() => setChannel(c)}
                className={`inline-flex items-center justify-center gap-1.5 rounded-md py-2.5 text-sm font-semibold transition ${
                  channel === c ? "bg-white text-ink shadow-sm" : "text-muted"
                }`}
              >
                <Icon size={15} aria-hidden /> {label}
              </button>
            ))}
          </div>
          {!userName && (
            <input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Your first name (to sign it)" aria-label="Your first name" className={field} />
          )}
          <button onClick={generate} disabled={busy} className={`${btn.primary} w-full`}>
            <Sparkles size={17} aria-hidden /> {busy ? "Writing your message…" : "Write my message"}
          </button>
          {error && <p className="text-sm text-bad">{error}</p>}
        </div>
      ) : (
        <SendBox key={latest.id} message={latest} />
      )}
    </section>
  );
}

function SendBox({ message }: { message: MessageView }) {
  const [text, setText] = useState(message.finalText ?? message.suggestedText);
  const [copied, setCopied] = useState(false);
  const [where, setWhere] = useState(message.channel === "email" ? "Email" : "WhatsApp");
  const [result, setResult] = useState<number | null>(message.sentAt ? message.wordsChanged : null);
  const [busy, setBusy] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the text can still be selected by hand */
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
      <div className="rise rounded-lg bg-ok-soft p-5 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ok text-white">
          <Check size={26} strokeWidth={3} aria-hidden />
        </span>
        <p className="mt-3 text-lg font-semibold">Sent. Nice work.</p>
        <p className="text-sm text-muted">
          You changed <b className="num text-ink">{result}</b> word{result === 1 ? "" : "s"} before sending. Saved with the line it disputes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-line bg-paper">
        <div className="flex items-center justify-between border-b border-line px-3 py-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5"><PenLine size={13} aria-hidden /> Edit anything before sending</span>
          <span className="num">{text.trim().split(/\s+/).length} words</span>
        </div>
        <label htmlFor="msg" className="sr-only">Message</label>
        <textarea
          id="msg"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={13}
          className="block w-full resize-y bg-transparent p-3 text-[15px] leading-relaxed outline-none"
        />
      </div>
      <p className="flex items-start gap-2 text-xs text-muted">
        <Paperclip size={14} className="mt-px shrink-0" aria-hidden />
        Attach the bill photo{message.channel === "email" ? " and the promise (box, plan page)" : ""} when you send it.
      </p>
      <button onClick={copy} className={`${btn.ghost} w-full`}>
        {copied ? <><Check size={16} className="text-ok" aria-hidden /> Copied</> : <><Copy size={16} aria-hidden /> Copy message</>}
      </button>
      <div className="rounded-lg bg-canvas p-3">
        <label htmlFor="where" className="mb-2 block text-sm font-medium">Sent it? Where to?</label>
        <div className="flex gap-2">
          <select id="where" value={where} onChange={(e) => setWhere(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2.5">
            {["Email", "WhatsApp", "Company app / website", "X (Twitter)", "Other"].map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
          <button onClick={markSent} disabled={busy} className={`${btn.success} px-4 py-2.5`}>
            <Check size={16} aria-hidden /> I sent it
          </button>
        </div>
      </div>
    </div>
  );
}
