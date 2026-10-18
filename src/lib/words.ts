// Counts how many words a person changed before sending the message.
// Word-level edit distance: every word added, removed or replaced counts as 1.

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[“”"'‘’()\[\],.;:!?]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function wordsChanged(suggested: string, sent: string): number {
  const a = tokenize(suggested);
  const b = tokenize(sent);
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}
