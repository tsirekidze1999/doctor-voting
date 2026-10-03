import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { hashPassword, verifyPassword } from "@/src/admin-password";
import { AdminError, audit, authenticate, COOKIE, failure, lockAdmin, readBody, sameOrigin } from "@/src/admin-auth";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await readBody(request);
    const { currentPassword, newPassword, confirmPassword } = body;
    if (typeof currentPassword !== "string" || !currentPassword || currentPassword.length > 256 ||
        typeof newPassword !== "string" || newPassword.length < 12 || newPassword.length > 128 || !newPassword.trim())
      throw new AdminError(400, "ახალი პაროლი უნდა შეიცავდეს 12–128 სიმბოლოს.");
    if (newPassword !== confirmPassword) throw new AdminError(400, "ახალი პაროლები არ ემთხვევა.");
    if (newPassword === currentPassword) throw new AdminError(400, "ახალი პაროლი ძველისგან უნდა განსხვავდებოდეს.");
    const result = await db.transaction(async tx => {
      await lockAdmin(tx);
      const { admin } = await authenticate(request, tx);
      const user = await tx.orm.public.AdminUser.where({ id: admin.id }).first();
      if (!user) throw new AdminError(401, "შედი ხელახლა.");
      const previous = await tx.orm.public.AdminLoginAttempt.where({ username: user.username }).first();
      const recent = previous && Date.now() - Date.parse(previous.windowStart) < 900_000;
      if (recent && previous.failures >= 8) return { status: 429, error: "მრავალი მცდელობა. სცადე 15 წუთში." };
      if (!await verifyPassword(currentPassword, user.passwordHash)) {
        const update = { failures: recent ? previous.failures + 1 : 1, windowStart: recent ? previous.windowStart : new Date().toISOString() };
        if (previous) await tx.orm.public.AdminLoginAttempt.where({ id: previous.id }).update(update);
        else await tx.orm.public.AdminLoginAttempt.create({ username: user.username, ...update });
        return { status: 400, error: "მიმდინარე პაროლი არასწორია." };
      }
      await tx.orm.public.AdminUser.where({ id: user.id }).update({ passwordHash: await hashPassword(newPassword) });
      const endedAt = new Date().toISOString();
      for (const c of await tx.orm.public.VerificationCode.where({email:"admin-recovery:"+user.username}).where(c=>c.consumedAt.isNull()).all()) await tx.orm.public.VerificationCode.where({id:c.id}).update({consumedAt:endedAt});
      for (const session of await tx.orm.public.AdminSession.where({ userId: user.id }).all()) {
        if (!session.endedAt) await tx.orm.public.AdminSession.where({ id: session.id }).update({ endedAt });
      }
      if (previous) await tx.orm.public.AdminLoginAttempt.where({ id: previous.id }).delete();
      await audit(tx, admin, "change-password", "საკუთარი პაროლი შეიცვალა; ყველა სესია გაუქმდა.");
      return { status: 200, success: true };
    });
    const response = NextResponse.json(result, { status: result.status });
    response.headers.set("Cache-Control", "no-store");
    if (result.status === 200) response.cookies.set(COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
    return response;
  } catch (error) { return failure(error); }
}
