import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "./prisma/db";
import { ALL_PERMISSIONS, type AdminIdentity } from "./admin-permissions";
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export const COOKIE = "doctor_admin_session";
export class AdminError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export function identity(user: { id: number; username: string; name: string; role: string; permissions: string; active: boolean }): AdminIdentity {
  let permissions: unknown = [];
  try { permissions = JSON.parse(user.permissions); } catch {}
  return { id: user.id, username: user.username, name: user.name, role: user.role, active: user.active,
    permissions: user.role === "superadmin" ? ALL_PERMISSIONS : ALL_PERMISSIONS.filter(p => Array.isArray(permissions) && permissions.includes(p)) };
}
export async function lockAdmin(tx: Tx) {
  await tx.execute(db.raw.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(9274201)` .returnsRow({ locked: "pg/int4@1" }).build());
}
export async function audit(tx: Tx, admin: AdminIdentity, action: string, detail: string) {
  await tx.orm.public.AdminAudit.create({ userId: admin.id, actorName: admin.name, action, detail });
}
export async function authenticate(request: Request, tx: Tx) {
  const token = request.headers.get("cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new AdminError(401, "შედი შენს ანგარიშზე");
  const session = await tx.orm.public.AdminSession.where({ tokenHash: tokenHash(token) }).first();
  if (!session || session.endedAt || new Date(session.expiresAt).getTime() <= Date.now()) throw new AdminError(401, "სესია დასრულდა. შედი ხელახლა.");
  const user = await tx.orm.public.AdminUser.where({ id: session.userId }).first();
  if (!user?.active) throw new AdminError(401, "ანგარიში გამორთულია");
  if (Date.now() - new Date(session.lastSeenAt).getTime() > 60_000) await tx.orm.public.AdminSession.where({ id: session.id }).update({ lastSeenAt: new Date().toISOString() });
  return { admin: identity(user), session };
}
export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) throw new AdminError(403, "მოთხოვნის წყარო დაუშვებელია");
}
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new AdminError(400, "საჭიროა JSON მოთხოვნა");
  const text = await request.text();
  if (text.length > 24_000) throw new AdminError(413, "მოთხოვნა მეტისმეტად დიდია");
  try { const value = JSON.parse(text); if (value && typeof value === "object" && !Array.isArray(value)) return value; } catch {}
  throw new AdminError(400, "მოთხოვნის ფორმატი არასწორია");
}
export function failure(error: unknown) {
  if (error instanceof AdminError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("Admin request failed", error instanceof Error ? error.message : "Unknown error");
  return NextResponse.json({ error: "სერვერთან დაკავშირება ვერ მოხერხდა. სცადე ხელახლა." }, { status: 503 });
}
