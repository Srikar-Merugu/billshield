// Loads a saved bill and re-runs the deterministic check on it.
import { checkBill, type CheckResult, type InputLine, type LineKind, type PromiseItem } from "./check";
import { sql } from "./db";

type Row = Record<string, unknown>;

export interface LineView {
  id: string;
  plainWords: string | null;
  seenBefore: number; // how many earlier bills (same device) had a line with the same name
}

export interface MessageView {
  id: string;
  lineItemId: string;
  channel: "email" | "chat";
  suggestedText: string;
  finalText: string | null;
  wordsChanged: number | null;
  sentWhere: string | null;
  sentAt: string | null;
  refundTotal: number;
}

export interface BillView {
  id: string;
  company: string | null;
  documentType: string | null;
  billDate: string | null;
  invoiceRef: string | null;
  currency: string;
  promiseSummary: string;
  promiseItems: PromiseItem[];
  promiseChangedFrom: string | null; // previous promise for this company, if it changed
  createdAt: string;
  check: CheckResult;
  lineViews: LineView[];
  printedHistory: { period: string; amount: number }[];
  messages: MessageView[];
}

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export async function loadBill(billId: string, deviceId: string): Promise<BillView | null> {
  const db = sql();
  const bills = (await db`
    select b.*, p.summary as promise_summary, p.items as promise_items, p.company as promise_company,
           p.valid_from as promise_valid_from
    from bill b left join promise p on p.id = b.promise_id
    where b.id = ${billId} and b.device_id = ${deviceId}`) as Row[];
  const bill = bills[0];
  if (!bill) return null;

  const lineRows = (await db`
    select l.*,
      (select count(distinct l2.bill_id) from line_item l2 join bill b2 on b2.id = l2.bill_id
        where b2.device_id = ${deviceId} and l2.normalized_label = l.normalized_label
          and l2.normalized_label <> '' and b2.created_at < ${bill.created_at as string}
          and l2.amount > 0) as seen_before
    from line_item l where l.bill_id = ${billId} order by l.position`) as Row[];
  const historyRows = (await db`
    select period, amount from printed_history where bill_id = ${billId} order by id`) as Row[];
  const messageRows = (await db`
    select * from message where bill_id = ${billId} order by created_at`) as Row[];
  const prevPromise = (await db`
    select summary from promise
    where device_id = ${deviceId} and company is not distinct from ${bill.promise_company as string | null}
      and valid_from < ${bill.promise_valid_from as string} order by valid_from desc limit 1`) as Row[];

  const promiseItems = (bill.promise_items as PromiseItem[] | null) ?? [];
  const lines: InputLine[] = lineRows.map((l) => ({
    label: l.label as string,
    amount: Number(l.amount),
    kind: l.kind as LineKind,
    taxRatePercent: num(l.tax_rate_percent),
    taxableBase: num(l.taxable_base),
    promiseItemIndex: num(l.promise_item_index),
    userAnswer: (l.user_answer as "agreed" | "disputed" | null) ?? null,
  }));

  const check = checkBill({ lines, printedTotal: num(bill.printed_total), promise: promiseItems });
  const previous = prevPromise[0]?.summary as string | undefined;

  return {
    id: bill.id as string,
    company: bill.company as string | null,
    documentType: bill.document_type as string | null,
    billDate: bill.bill_date ? new Date(bill.bill_date as string).toISOString().slice(0, 10) : null,
    invoiceRef: bill.invoice_ref as string | null,
    currency: bill.currency as string,
    promiseSummary: (bill.promise_summary as string) ?? "",
    promiseItems,
    promiseChangedFrom: previous && previous !== bill.promise_summary ? previous : null,
    createdAt: new Date(bill.created_at as string).toISOString(),
    check,
    lineViews: lineRows.map((l) => ({
      id: l.id as string,
      plainWords: l.plain_words as string | null,
      seenBefore: Number(l.seen_before ?? 0),
    })),
    printedHistory: historyRows.map((h) => ({ period: h.period as string, amount: Number(h.amount) })),
    messages: messageRows.map((m) => ({
      id: m.id as string,
      lineItemId: m.line_item_id as string,
      channel: m.channel as "email" | "chat",
      suggestedText: m.suggested_text as string,
      finalText: m.final_text as string | null,
      wordsChanged: num(m.words_changed),
      sentWhere: m.sent_where as string | null,
      sentAt: m.sent_at ? new Date(m.sent_at as string).toISOString() : null,
      refundTotal: Number(m.refund_total),
    })),
  };
}

/** Keeps the stored status/difference in step with what the checker says now. */
export async function syncLineStatuses(view: BillView): Promise<void> {
  const db = sql();
  for (const [i, line] of view.check.lines.entries()) {
    await db`update line_item set status = ${line.status}, difference = ${line.difference},
      promised_amount = ${line.promisedAmount} where id = ${view.lineViews[i].id}`;
  }
  await db`update bill set verdict = ${view.check.verdict} where id = ${view.id}`;
}
