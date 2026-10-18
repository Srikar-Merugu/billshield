import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { Logo } from "./ui";

export function Header({ compact, onHome }: { compact?: boolean; onHome?: () => void }) {
  return (
    <header className="grid-bg relative overflow-hidden bg-ink text-white">
      <div className="mx-auto w-full max-w-2xl px-4">
        <div className="flex items-center justify-between py-4">
          <Link href="/" onClick={onHome} className="flex items-center gap-2 rounded focus-visible:outline-2 focus-visible:outline-accent">
            <Logo />
            <span className="text-lg font-bold tracking-tight">BillShield</span>
          </Link>
          <Link
            href="/history"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/90 transition hover:bg-white/10"
          >
            <ReceiptText size={15} aria-hidden /> My bills
          </Link>
        </div>

        {!compact && (
          <div className="pb-16 pt-6 sm:pb-20 sm:pt-10">
            <p className="num mb-3 text-xs uppercase tracking-[0.2em] text-accent">Bill checker</p>
            <h1 className="max-w-md text-[34px] font-bold leading-[1.1] tracking-tight sm:text-5xl">
              Find the charge that doesn&apos;t add up.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/70">
              Upload a bill and tell us what you were promised. Code checks every line and every rupee.
              You get one message worth sending.
            </p>
            <ol className="mt-7 grid max-w-md grid-cols-3 gap-2 text-[12px] text-white/80">
              {["Upload the bill", "Every line checked", "Send one message"].map((s, i) => (
                <li key={s} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
                  <span className="num block text-accent">0{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        )}
        {compact && <div className="pb-14" />}
      </div>
    </header>
  );
}
