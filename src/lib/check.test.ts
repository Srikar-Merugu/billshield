import { describe, expect, it } from "vitest";
import { checkBill, formatMoney } from "./check";
import { wordsChanged } from "./words";
import { maskText } from "./mask";
import { checkTemplate, fillTemplate, fallbackTemplate, type MessageFacts } from "./message";

// Golden pairs from the by-hand sessions (numbers only, no personal details).

describe("golden pair: Aditya, store receipt (offer price on the box)", () => {
  const result = checkBill({
    printedTotal: 2812,
    promise: [{ label: "RC car offer price", price: 1299 }],
    lines: [
      { label: "The Entrepreneurial (book)", amount: 499, kind: "charge" },
      { label: "Veva Toys RC Car-Rock", amount: 1699, kind: "charge", promiseItemIndex: 0 },
      { label: "Loope Color Pop", amount: 599, kind: "charge", userAnswer: "agreed" },
      { label: "Paper bag", amount: 15, kind: "charge", userAnswer: "agreed" },
      { label: "CGST", amount: 55.07, kind: "tax", taxRatePercent: 2.5, taxableBase: 2202.86 },
      { label: "SGST", amount: 55.07, kind: "tax", taxRatePercent: 2.5, taxableBase: 2202.86 },
    ],
  });

  it("detects tax already inside the prices and the total matches", () => {
    expect(result.taxMode).toBe("included_in_prices");
    expect(result.totalMatches).toBe(true);
    expect(result.taxChecks.every((t) => t.ok)).toBe(true);
  });

  it("flags the RC car: ₹1,699 charged vs ₹1,299 promised = ₹400", () => {
    expect(result.verdict).toBe("overcharged");
    const car = result.lines[1];
    expect(car.status).toBe("wrong");
    expect(car.difference).toBe(400);
    expect(result.taxOnOvercharge).toBe(0); // GST is inside the price, nothing extra
    expect(result.refundTotal).toBe(400);
  });

  it("asks about the book until the user answers", () => {
    expect(result.lines[0].status).toBe("unexplained");
  });
});

describe("golden pair: Jagdeep, Thai phone bill (all correct, 7% VAT)", () => {
  const result = checkBill({
    printedTotal: 747.93,
    promise: [{ label: "699 plan", price: 699 }],
    lines: [
      { label: "Package fee RET GNL699B", amount: 699, kind: "charge", promiseItemIndex: 0 },
      { label: "Exceeding package", amount: 0, kind: "charge" },
      { label: "VAT 7%", amount: 48.93, kind: "tax", taxRatePercent: 7 },
    ],
  });

  it("says every line checks out, with the maths", () => {
    expect(result.verdict).toBe("all_correct");
    expect(result.taxMode).toBe("added_on_top");
    expect(result.computedTotal).toBe(747.93);
    expect(result.taxChecks[0]).toMatchObject({ base: 699, expected: 48.93, ok: true });
  });
});

describe("golden pair: Jagan, HDFC EMI (all correct)", () => {
  const result = checkBill({
    printedTotal: 17414,
    promise: [
      { label: "EMI principal", price: 16515 },
      { label: "EMI interest at 16%", price: 899 },
    ],
    lines: [
      { label: "EMI principal (instalment 3)", amount: 16515, kind: "charge", promiseItemIndex: 0 },
      { label: "EMI interest (instalment 3)", amount: 899, kind: "charge", promiseItemIndex: 1 },
    ],
  });

  it("adds up and matches the promise", () => {
    expect(result.totalMatches).toBe(true);
    expect(result.verdict).toBe("all_correct");
  });
});

describe("synthetic test bill 01 (CallerTune pack never asked for)", () => {
  const base = {
    printedTotal: 823.64,
    promise: [{ label: "Smart 499 plan", price: 499 }],
  };
  const lines = [
    { label: "Monthly plan rental Smart 499", amount: 499, kind: "charge" as const, promiseItemIndex: 0 },
    { label: "CallerTune Plus Pack", amount: 199, kind: "charge" as const },
    { label: "Late payment fee", amount: 0, kind: "charge" as const },
    { label: "CGST @ 9%", amount: 62.82, kind: "tax" as const, taxRatePercent: 9 },
    { label: "SGST @ 9%", amount: 62.82, kind: "tax" as const, taxRatePercent: 9 },
  ];

  it("asks about the pack first instead of guessing", () => {
    const r = checkBill({ ...base, lines });
    expect(r.verdict).toBe("needs_answer");
    expect(r.lines[1].status).toBe("unexplained");
    expect(r.lines[2].status).toBe("ok"); // ₹0 late fee is not an error
  });

  it("after 'I never agreed': refund ₹199 + ₹35.82 GST = ₹234.82", () => {
    const answered = lines.map((l, i) => (i === 1 ? { ...l, userAnswer: "disputed" as const } : l));
    const r = checkBill({ ...base, lines: answered });
    expect(r.verdict).toBe("overcharged");
    expect(r.overchargeBeforeTax).toBe(199);
    expect(r.taxOnOvercharge).toBe(35.82);
    expect(r.refundTotal).toBe(234.82);
  });
});

describe("maths errors are caught", () => {
  it("flags a total that doesn't add up", () => {
    const r = checkBill({
      printedTotal: 640,
      promise: [],
      lines: [{ label: "Plan", amount: 499, kind: "charge", userAnswer: "agreed" }],
    });
    expect(r.verdict).toBe("maths_error");
    expect(r.totalMatches).toBe(false);
  });
});

describe("words changed", () => {
  it("counts zero for an unchanged message", () => {
    expect(wordsChanged("Please refund ₹400.", "please refund ₹400")).toBe(0);
  });
  it("counts replacements and additions", () => {
    expect(wordsChanged("I bought a car", "I purchased a toy car")).toBe(2);
  });
});

describe("masking before saving", () => {
  it("hides emails and long numbers", () => {
    const out = maskText("mail me at someone@gmail.com, phone 98765 43210, acct 25166498");
    expect(out).not.toContain("gmail.com");
    expect(out).not.toContain("98765");
    expect(out).not.toContain("25166498");
  });
});

describe("message verifier", () => {
  it("rejects a template where the AI typed a number", () => {
    expect(checkTemplate("Please refund ₹400.").ok).toBe(false);
    expect(checkTemplate("Please refund {{REFUND_TOTAL}}.").ok).toBe(true);
  });
  it("fallback template passes its own verifier and fills cleanly", () => {
    const t = fallbackTemplate("email");
    expect(checkTemplate(t).ok).toBe(true);
    const facts = Object.fromEntries(
      ["COMPANY", "INVOICE_REF", "BILL_DATE", "PROMISE", "DISPUTED_LINES", "CHARGED", "PROMISED",
        "DIFFERENCE", "TAX_ON_DIFFERENCE", "REFUND_TOTAL", "BILL_TOTAL", "USER_NAME"].map((k) => [k, "x"]),
    ) as MessageFacts;
    expect(fillTemplate(t, facts)).not.toContain("{{");
  });
});

describe("money format", () => {
  it("uses Indian grouping for rupees", () => {
    expect(formatMoney(104484, "INR")).toBe("₹1,04,484.00");
    expect(formatMoney(747.93, "THB")).toBe("฿747.93");
  });
});
