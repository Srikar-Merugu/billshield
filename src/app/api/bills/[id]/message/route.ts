import { NextResponse } from "next/server";
import { writeMessageTemplate } from "@/lib/ai";
import { loadBill } from "@/lib/bills";
import { formatMoney } from "@/lib/check";
import { getDeviceId, sql } from "@/lib/db";
import { fallbackTemplate, fillTemplate, type MessageFacts } from "@/lib/message";

export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deviceId = getDeviceId(req);
  const body = (await req.json()) as { channel?: string; userName?: string };
  const channel = body.channel === "chat" ? "chat" : "email";
  const userName = (body.userName ?? "").trim().slice(0, 60);

  const view = await loadBill(id, deviceId);
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { check, currency } = view;
  const disputed = check.lines.filter((l) => l.status === "wrong" || l.status === "disputed");
  if (disputed.length === 0) {
    return NextResponse.json({ error: "There is no wrong charge to write about." }, { status: 422 });
  }
  const money = (n: number) => formatMoney(n, currency);
  const hasTax = check.taxOnOvercharge > 0;

  // Every number in the message is computed here, by code.
  const facts: MessageFacts = {
    COMPANY: view.company ?? "your company",
    INVOICE_REF: view.invoiceRef ?? "see attached bill",
    BILL_DATE: view.billDate
      ? new Date(view.billDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : "recently",
    PROMISE: view.promiseSummary,
    DISPUTED_LINES: disputed
      .map((l) =>
        l.status === "disputed"
          ? `- ${l.label}: ${money(l.amount)}, which I never agreed to`
          : `- ${l.label}: charged ${money(l.amount)}, promised ${money(l.promisedAmount ?? 0)}`,
      )
      .join("\n"),
    CHARGED: money(disputed.reduce((a, l) => a + l.amount, 0)),
    PROMISED: money(disputed.reduce((a, l) => a + (l.promisedAmount ?? 0), 0)),
    DIFFERENCE: money(check.overchargeBeforeTax),
    TAX_ON_DIFFERENCE: hasTax ? money(check.taxOnOvercharge) : "none",
    REFUND_TOTAL: money(check.refundTotal),
    BILL_TOTAL: money(check.printedTotal ?? check.computedTotal),
    USER_NAME: userName,
  };

  // The AI only sees the situation with digits hidden, so it can't copy numbers.
  const context = [
    `Company: ${view.company ?? "unknown"} (${view.documentType ?? "bill"})`,
    `Promise: ${view.promiseSummary}`,
    `Invoice number on the bill: ${view.invoiceRef ? "yes" : "no"}`,
    ...disputed.map((l) => `Disputed line: ${l.label} (${l.status === "wrong" ? "charged more than promised" : "never agreed to"})`),
    `Tax on the difference: ${hasTax ? "yes" : "none"}`,
    `Customer name given: ${userName ? "yes" : "no"}`,
  ]
    .join("\n")
    .replace(/\d/g, "#");

  let template = await writeMessageTemplate(channel, context).catch(() => null);
  const writtenBy = template ? "ai" : "fallback";
  template ??= fallbackTemplate(channel, hasTax);
  const text = fillTemplate(template, facts);

  const main = disputed.reduce((a, b) => (b.difference > a.difference ? b : a));
  const mainLineId = view.lineViews[main.index].id;
  await sql()`
    insert into message (line_item_id, bill_id, channel, suggested_text, written_by, refund_total)
    values (${mainLineId}, ${id}, ${channel}, ${text}, ${writtenBy}, ${check.refundTotal})`;

  const updated = await loadBill(id, deviceId);
  return NextResponse.json(updated);
}
