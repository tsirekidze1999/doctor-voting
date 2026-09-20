// Georgian mobile numbers only. All accepted input formats become E.164.
export function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 32) return null;
  const compact = value.trim().replace(/[\s()-]/g, "");
  if (/^5\d{8}$/.test(compact)) return "+995" + compact;
  if (/^9955\d{8}$/.test(compact)) return "+" + compact;
  if (/^\+9955\d{8}$/.test(compact)) return compact;
  if (/^009955\d{8}$/.test(compact)) return "+" + compact.slice(2);
  return null;
}

