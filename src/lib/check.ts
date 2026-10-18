// The "code decides" side of BillShield.
// Pure functions only: same input, same answer, every time. No AI in this file.
// All money is handled in integer paise (or cents) so 0.1 + 0.2 problems never happen.

export type LineKind = "charge" | "discount" | "tax" | "payment" | "other";

export type LineStatus =
  | "ok" // matches the promise (or is a tax/discount line that checks out)
  | "wrong" // matched to a promise item, but the amount differs
  | "unexplained" // a charge we can't match to anything promised; we ask the user
  | "agreed" // user said "yes, I agreed to this"
  | "disputed"; // user said "no, I never agreed to this"

export interface InputLine {
  label: string;
  amount: number; // as printed on the bill, in currency units (e.g. 199.00)
  kind: LineKind;
  taxRatePercent?: number | null; // printed rate on a tax line, e.g. 9 for CGST 9%
  taxableBase?: number | null; // printed base for that tax line, if shown
  promiseItemIndex?: number | null; // which promise item this line belongs to (from AI reading)
  userAnswer?: "agreed" | "disputed" | null;
}

export interface PromiseItem {
  label: string;
  price: number; // the amount that should appear on the matching bill line
}

export interface CheckInput {
  lines: InputLine[];
  printedTotal: number | null;
  promise: PromiseItem[];
}

export interface CheckedLine extends InputLine {
  index: number;
  status: LineStatus;
  promisedAmount: number | null;
  difference: number; // amount - promised (positive = overcharged); 0 for ok lines
}

export interface TaxCheck {
  label: string;
  rate: number;
  base: number;
  expected: number;
  printed: number;
  ok: boolean;
}

export interface CheckResult {
  lines: CheckedLine[];
  chargesTotal: number; // charges + other - discounts
  taxTotal: number;
  computedTotal: number; // what the lines actually add up to, using the detected tax mode
  printedTotal: number | null;
  totalMatches: boolean | null; // null when the bill has no printed total
  taxMode: "added_on_top" | "included_in_prices" | "unknown";
  effectiveTaxRate: number; // e.g. 0.18 when tax is added on top; 0 otherwise
  taxChecks: TaxCheck[];
  overchargeBeforeTax: number; // sum of differences on wrong/disputed lines
  taxOnOvercharge: number;
  refundTotal: number;
  verdict: "all_correct" | "needs_answer" | "overcharged" | "maths_error";
}

const TOLERANCE_PAISE = 100; // ₹1 / ฿1 rounding slack, bills round per line

export const toPaise = (n: number): number => Math.round(n * 100);
export const fromPaise = (p: number): number => p / 100;

function sumPaise(values: number[]): number {
  return values.reduce((acc, v) => acc + toPaise(v), 0);
}

export function checkBill(input: CheckInput): CheckResult {
  const { lines, printedTotal, promise } = input;

  const chargeLike = lines.filter((l) => l.kind === "charge" || l.kind === "other");
  const discounts = lines.filter((l) => l.kind === "discount");
  const taxes = lines.filter((l) => l.kind === "tax");

  const chargesPaise =
    sumPaise(chargeLike.map((l) => l.amount)) - sumPaise(discounts.map((l) => Math.abs(l.amount)));
  const taxPaise = sumPaise(taxes.map((l) => l.amount));

  // Work out whether tax is added on top of the lines (phone bills) or already inside
  // the prices (shop receipts, where the GST table is only a summary).
  let taxMode: CheckResult["taxMode"] = "unknown";
  let computedPaise = chargesPaise + taxPaise;
  if (printedTotal !== null) {
    const printedPaise = toPaise(printedTotal);
    if (Math.abs(chargesPaise + taxPaise - printedPaise) <= TOLERANCE_PAISE) {
      taxMode = taxPaise > 0 ? "added_on_top" : "included_in_prices";
      computedPaise = chargesPaise + taxPaise;
    } else if (taxPaise > 0 && Math.abs(chargesPaise - printedPaise) <= TOLERANCE_PAISE) {
      taxMode = "included_in_prices";
      computedPaise = chargesPaise;
    }
  } else if (taxPaise === 0) {
    taxMode = "included_in_prices";
  }

  const totalMatches =
    printedTotal === null ? null : Math.abs(computedPaise - toPaise(printedTotal)) <= TOLERANCE_PAISE;

  // Check every tax line: base × printed rate should equal the printed tax.
  const defaultBasePaise = taxMode === "included_in_prices" ? null : chargesPaise;
  const taxChecks: TaxCheck[] = [];
  for (const t of taxes) {
    if (t.taxRatePercent == null) continue;
    const basePaise = t.taxableBase != null ? toPaise(t.taxableBase) : defaultBasePaise;
    if (basePaise === null) continue;
    const expectedPaise = Math.round((basePaise * t.taxRatePercent) / 100);
    taxChecks.push({
      label: t.label,
      rate: t.taxRatePercent,
      base: fromPaise(basePaise),
      expected: fromPaise(expectedPaise),
      printed: t.amount,
      ok: Math.abs(expectedPaise - toPaise(t.amount)) <= TOLERANCE_PAISE,
    });
  }

  const effectiveTaxRate =
    taxMode === "added_on_top" && chargesPaise > 0 ? taxPaise / chargesPaise : 0;

  // Compare each charge line with the promise.
  const checked: CheckedLine[] = lines.map((line, index) => {
    const base = { ...line, index, promisedAmount: null as number | null, difference: 0 };
    if (line.kind !== "charge" && line.kind !== "other") {
      return { ...base, status: "ok" as LineStatus };
    }
    const item =
      line.promiseItemIndex != null && line.promiseItemIndex >= 0
        ? promise[line.promiseItemIndex]
        : undefined;
    if (item) {
      const diffPaise = toPaise(line.amount) - toPaise(item.price);
      if (diffPaise > TOLERANCE_PAISE) {
        return { ...base, status: "wrong", promisedAmount: item.price, difference: fromPaise(diffPaise) };
      }
      return { ...base, status: "ok", promisedAmount: item.price };
    }
    if (toPaise(line.amount) <= 0) return { ...base, status: "ok" };
    // Not in the promise: only the user can say if they agreed to it.
    if (line.userAnswer === "agreed") return { ...base, status: "agreed" };
    if (line.userAnswer === "disputed") {
      return { ...base, status: "disputed", promisedAmount: 0, difference: line.amount };
    }
    return { ...base, status: "unexplained" };
  });

  const overPaise = checked
    .filter((l) => l.status === "wrong" || l.status === "disputed")
    .reduce((acc, l) => acc + toPaise(l.difference), 0);
  const taxOnOverPaise = Math.round(overPaise * effectiveTaxRate);

  let verdict: CheckResult["verdict"];
  if (totalMatches === false || taxChecks.some((t) => !t.ok)) verdict = "maths_error";
  else if (overPaise > 0) verdict = "overcharged";
  else if (checked.some((l) => l.status === "unexplained")) verdict = "needs_answer";
  else verdict = "all_correct";

  return {
    lines: checked,
    chargesTotal: fromPaise(chargesPaise),
    taxTotal: fromPaise(taxPaise),
    computedTotal: fromPaise(computedPaise),
    printedTotal,
    totalMatches,
    taxMode,
    effectiveTaxRate,
    taxChecks,
    overchargeBeforeTax: fromPaise(overPaise),
    taxOnOvercharge: fromPaise(taxOnOverPaise),
    refundTotal: fromPaise(overPaise + taxOnOverPaise),
    verdict,
  };
}

export function formatMoney(amount: number, currency: string): string {
  const symbol: Record<string, string> = { INR: "₹", THB: "฿", USD: "$", EUR: "€", GBP: "£" };
  const s = symbol[currency] ?? `${currency} `;
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return `${sign}${s}${abs.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
