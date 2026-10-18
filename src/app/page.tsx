"use client";

import { useEffect, useState } from "react";
import { CircleAlert, RotateCcw } from "lucide-react";
import type { BillView } from "@/lib/bills";
import { api } from "@/lib/client";
import { Header } from "@/components/Header";
import { Reading } from "@/components/Reading";
import { Result } from "@/components/Result";
import { UploadForm } from "@/components/UploadForm";
import { btn } from "@/components/ui";

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
    window.scrollTo({ top: 0 });
    try {
      setBill(await api<BillView>("/api/analyze", { method: "POST", body: form }));
      setStage("result");
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError((e as Error).message);
      setStage("form");
    }
  }

  function reset() {
    setStage("form");
    setBill(null);
    setError(null);
    window.history.replaceState(null, "", "/");
  }

  return (
    <>
      <Header compact={stage !== "form"} onHome={reset} />
      <main className="relative mx-auto -mt-10 w-full max-w-2xl px-4 pb-12">
        {error && (
          <p role="alert" className="rise mb-3 flex items-start gap-2 rounded-lg border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">
            <CircleAlert size={18} className="mt-px shrink-0" aria-hidden /> {error}
          </p>
        )}
        {stage === "form" && <UploadForm onSubmit={analyze} userName={userName} setUserName={setUserName} />}
        {stage === "reading" && <Reading />}
        {stage === "result" && bill && (
          <>
            <Result bill={bill} setBill={setBill} userName={userName} setUserName={setUserName} />
            <button onClick={reset} className={`${btn.ghost} mt-6 w-full`}>
              <RotateCcw size={16} aria-hidden /> Check another bill
            </button>
          </>
        )}
      </main>
    </>
  );
}
