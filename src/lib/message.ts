// The AI writes the words; code writes every number.
// The AI gets placeholder names only (e.g. {{CHARGED}}) and is not allowed to type digits.
// This file fills the placeholders and rejects any template that sneaks a number in.

export const PLACEHOLDERS = [
  "COMPANY",
  "INVOICE_REF",
  "BILL_DATE",
  "PROMISE",
  "DISPUTED_LINES",
  "CHARGED",
  "PROMISED",
  "DIFFERENCE",
  "TAX_ON_DIFFERENCE",
  "REFUND_TOTAL",
  "BILL_TOTAL",
  "USER_NAME",
] as const;

export type Placeholder = (typeof PLACEHOLDERS)[number];
export type MessageFacts = Record<Placeholder, string>;

const PLACEHOLDER_RE = /\{\{([A-Z_]+)\}\}/g;

export interface TemplateCheck {
  ok: boolean;
  problems: string[];
}

/** The verifier: no digit may appear outside a placeholder, and only known placeholders are used. */
export function checkTemplate(template: string): TemplateCheck {
  const problems: string[] = [];
  for (const m of template.matchAll(PLACEHOLDER_RE)) {
    if (!(PLACEHOLDERS as readonly string[]).includes(m[1])) problems.push(`unknown placeholder {{${m[1]}}}`);
  }
  const withoutPlaceholders = template.replace(PLACEHOLDER_RE, "");
  const digits = withoutPlaceholders.match(/\d+/g);
  if (digits) problems.push(`AI typed numbers itself: ${digits.join(", ")}`);
  if (/[₹฿$€£]/.test(withoutPlaceholders)) problems.push("AI typed a currency symbol itself");
  return { ok: problems.length === 0, problems };
}

export function fillTemplate(template: string, facts: MessageFacts): string {
  return template
    .replace(PLACEHOLDER_RE, (_, key: Placeholder) => facts[key] ?? "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Used when the AI is unavailable or keeps failing the verifier. Fully deterministic. */
export function fallbackTemplate(channel: "email" | "chat", hasTax = true): string {
  const taxPart = hasTax ? " plus {{TAX_ON_DIFFERENCE}} tax on it" : "";
  const body =
    "I was promised {{PROMISE}}. My bill from {{COMPANY}} dated {{BILL_DATE}} ({{INVOICE_REF}}) includes:\n" +
    "{{DISPUTED_LINES}}\n\n" +
    `I was charged {{CHARGED}} where I should have been charged {{PROMISED}}, a difference of {{DIFFERENCE}}${taxPart}.\n` +
    "Please correct this and refund {{REFUND_TOTAL}}. I have attached the bill for reference.";
  return channel === "email"
    ? `Subject: Refund request for incorrect charge on {{INVOICE_REF}}\n\nHello,\n\n${body}\n\nThank you,\n{{USER_NAME}}`
    : `Hi, ${body}\nThanks, {{USER_NAME}}`;
}
