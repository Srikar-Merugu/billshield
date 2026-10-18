"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Camera, FileText, Lock, RefreshCw } from "lucide-react";
import { prepareFile } from "@/lib/client";
import { btn, field, Panel } from "./ui";

const EXAMPLES = [
  "My plan is ₹499 a month + GST, nothing else",
  "The box says offer price ₹1,299",
  "EMI at 16% interest, no extra charges",
];

export function UploadForm({
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
  const ready = !!billFile && (!!promiseText.trim() || !!promiseFile);

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
    <form onSubmit={submit} className="space-y-3">
      <Panel>
        <StepLabel n={1} title="Your bill" hint="Phone, internet, electricity, card statement or a shop receipt." />
        <Dropzone file={billFile} onPick={setBillFile} title="Add a photo or PDF" required />
      </Panel>

      <Panel>
        <StepLabel n={2} title="What were you promised?" hint="Every line is checked against this." />
        <label htmlFor="promise" className="sr-only">What were you promised?</label>
        <textarea
          id="promise"
          value={promiseText}
          onChange={(e) => setPromiseText(e.target.value)}
          rows={3}
          placeholder="Plan price, offer, interest rate…"
          className={field}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setPromiseText(ex)}
              className="rounded-full border border-line bg-white px-2.5 py-1 text-xs text-muted transition hover:border-ink/30 hover:text-ink"
            >
              {ex}
            </button>
          ))}
        </div>
        <p className="mb-2 mt-5 text-sm font-medium">
          Promise printed somewhere? <span className="font-normal text-muted">(optional)</span>
        </p>
        <Dropzone file={promiseFile} onPick={setPromiseFile} title="Photo of the box, plan page or offer" small />
      </Panel>

      <Panel>
        <StepLabel n={3} title="Your first name" hint="Optional. Only used to sign the message." />
        <label htmlFor="name" className="sr-only">Your first name</label>
        <input id="name" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="e.g. Aditya" className={field} />
      </Panel>

      <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-canvas via-canvas to-transparent px-4 pb-4 pt-6">
        <button type="submit" disabled={!ready || busy} className={`${btn.accent} w-full text-[17px] disabled:bg-line disabled:text-muted disabled:opacity-100`}>
          Check my bill <ArrowRight size={18} aria-hidden />
        </button>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted">
          <Lock size={12} aria-hidden /> Names, phone and account numbers are hidden before saving.
        </p>
      </div>
    </form>
  );
}

function StepLabel({ n, title, hint }: { n: number; title: string; hint: string }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <span className="num mt-0.5 text-sm font-semibold text-accent">0{n}</span>
      <div>
        <h2 className="font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted">{hint}</p>
      </div>
    </div>
  );
}

function Dropzone({
  file,
  onPick,
  title,
  required,
  small,
}: {
  file: File | null;
  onPick: (f: File | null) => void;
  title: string;
  required?: boolean;
  small?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <label
      className={`group flex cursor-pointer items-center gap-4 rounded-lg border border-dashed transition focus-within:ring-4 focus-within:ring-accent/25 ${
        file ? "border-ok/40 bg-ok-soft/60" : "border-ink/20 bg-white hover:border-ink/40"
      } ${small ? "p-3" : "p-4"}`}
    >
      <span
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md ${
          small ? "h-11 w-11" : "h-16 w-16"
        } ${file ? "bg-white" : "bg-canvas"}`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : file ? (
          <FileText className="text-ok" aria-hidden />
        ) : (
          <Camera className="text-muted transition group-hover:text-ink" aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{file ? file.name : title}</span>
        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
          {file ? (
            <>
              <RefreshCw size={11} aria-hidden /> Tap to change
            </>
          ) : (
            "Tap to take a photo or choose a file"
          )}
        </span>
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
