// Runs on every piece of text before it is saved. Store the least:
// no emails, phone numbers, account or card numbers.

export function maskText(text: string): string {
  return (
    text
      // emails
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email hidden]")
      // long digit runs (account, card, loan, phone numbers), spaces/dashes allowed inside
      .replace(/(?:\+?\d[\s-]?){7,}\d/g, (m) => {
        const digits = m.replace(/\D/g, "");
        return `XXXX${digits.slice(-2)}`;
      })
  );
}

export function maskNullable(text: string | null | undefined): string | null {
  return text == null ? null : maskText(text);
}
