import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { verifyPassword } from "@/src/admin-password";
import { AdminError, audit, authenticate, COOKIE, failure, identity, lockAdmin, readBody, sameOrigin, tokenHash } from "@/src/admin-auth";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await readBody(request);
    if (typeof body.username !== "string" || typeof body.password !== "string" || body.password.length > 256) throw new AdminError(400, "შეიყვანე მომხმარებელი და პაროლი");
    const username = body.username.trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,40}$/.test(username)) throw new AdminError(401, "მომხმარებელი ან პაროლი არასწორია");
    const password = body.password;
    const token = randomBytes(32).toString("hex");
    const result = await db.transaction(async tx => {
      await lockAdmin(tx);
      const previous = await tx.orm.public.AdminLoginAttempt.where({ username }).first();
      const recent = previous && Date.now() - new Date(previous.windowStart).getTime() < 900_000;
      if (recent && previous.failures >= 8) return { status: 429, error: "მრავალი მცდელობა. სცადე 15 წუთში." };
      const user = await tx.orm.public.AdminUser.where({ username }).first();
      if (!user?.active || !await verifyPassword(password, user.passwordHash)) {
        const update = { failures: recent ? previous.failures + 1 : 1, windowStart: recent ? previous.windowStart : new Date().toISOString() };
        if (previous) await tx.orm.public.AdminLoginAttempt.where({ id: previous.id }).update(update);
        else await tx.orm.public.AdminLoginAttempt.create({ username, ...update });
        return { status: 401, error: "მომხმარებელი ან პაროლი არასწორია" };
      }
      if (previous) await tx.orm.public.AdminLoginAttempt.where({ id: previous.id }).delete();
      await tx.orm.public.AdminSession.create({ userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 12 * 3600_000).toISOString() });
      await audit(tx, identity(user), "login", "წარმატებული ავტორიზაცია");
      return { status: 200, admin: identity(user) };
    });
    const response = NextResponse.json(result, { status: result.status });
    if (result.status === 200) response.cookies.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 12 * 3600 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) { return failure(error); }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    await db.transaction(async tx => {
      await lockAdmin(tx);
      const { admin, session } = await authenticate(request, tx);
      await tx.orm.public.AdminSession.where({ id: session.id }).update({ endedAt: new Date().toISOString() });
      await audit(tx, admin, "logout", "ანგარიშიდან გასვლა");
    });
    const response = NextResponse.json({ success: true });
    response.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
    return response;
  } catch (error) { return failure(error); }
}
