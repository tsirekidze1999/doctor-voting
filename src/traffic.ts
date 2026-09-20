const clients = new Map<string, number>();
const limit = () => Number(process.env.QUEUE_LIMIT || 1000);
export function trafficStatus(clientId: string) {
  const now = Date.now();
  for (const [id, last] of clients) if (now - last > 90_000) clients.delete(id);
  const existing = clients.has(clientId);
  if (existing) clients.set(clientId, now);
  const active = clients.size;
  if (existing || active < limit()) { clients.set(clientId, now); return { allowed: true, active, limit: limit(), position: 0 }; }
  const position = [...clients.entries()].filter(([, last]) => last <= now).length + 1;
  return { allowed: false, active, limit: limit(), position };
}
