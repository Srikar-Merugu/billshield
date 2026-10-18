"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Panel } from "./ui";

const STEPS = ["Reading every line", "Adding up the totals", "Checking the tax", "Comparing with your promise"];

export function Reading() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, STEPS.length - 1)), 7000);
    return () => clearInterval(t);
  }, []);

  return (
    <Panel>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center" aria-live="polite" aria-busy="true">
        <div className="relative mx-auto h-40 w-32 shrink-0 overflow-hidden rounded-md border border-line bg-white p-3">
          {Array.from({ length: 9 }).map((_, k) => (
            <div key={k} className="mb-2.5 flex justify-between gap-2">
              <span className="h-1.5 rounded bg-line" style={{ width: `${40 + ((k * 17) % 35)}%` }} />
              <span className="h-1.5 w-6 rounded bg-line" />
            </div>
          ))}
          <div className="scanline absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-accent/35 to-transparent" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold tracking-tight">Checking your bill…</h2>
          <p className="mb-4 text-sm text-muted">Usually 15–40 seconds.</p>
          <ul className="space-y-2.5">
            {STEPS.map((s, k) => (
              <li key={s} className={`flex items-center gap-2.5 text-sm ${k > i ? "text-muted/60" : ""}`}>
                {k < i ? (
                  <Check size={16} className="text-ok" aria-hidden />
                ) : k === i ? (
                  <Loader2 size={16} className="animate-spin text-accent" aria-hidden />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-line" aria-hidden />
                )}
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}
