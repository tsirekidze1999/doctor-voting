import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { AdminError, audit, COOKIE, failure, identity, lockAdmin, readBody, sameOrigin } from "@/src/admin-auth";
import { hashPassword, verifyPassword } from "@/src/admin-password";
import { isUbillSmsEnabled, sendSmsCode } from "@/src/sms";

// Recovery messages can only go to the owner's verified recovery destination.
const RECOVERY_PHONE = "+995592308338";
const PREFIX = "admin-recovery:";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await readBody(request, 4000);
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    if (!/^[a-z0-9_.-]{3,40}$/.test(username)) throw new AdminError(400, "შეიყვანე მომხმარებლის სახელი");
    const result = await db.transaction(async tx => {
      await lockAdmin(tx);
      const user = await tx.orm.public.AdminUser.where({ username, active: true }).first();
      if (body.action === "send") {
        if (!isUbillSmsEnabled()) throw new AdminError(503, "აღდგენის SMS სერვისი ამჟამად მიუწვდომელია");
        const recent = await tx.orm.public.VerificationCode.where(c => c.email.like(PREFIX + "%")).orderBy(c => c.id.desc()).limit(20).all();
        const hour = recent.filter(c => Date.now() - Date.parse(c.createdAt) < 3600000);
        if (hour.length >= 5 || (recent[0] && Date.now() - Date.parse(recent[0].createdAt) < 60000)) throw new AdminError(429, "დაელოდე: კოდის მოთხოვნა შესაძლებელია წუთში ერთხელ, მაქსიმუმ 5-ჯერ საათში.");
        // Unknown accounts receive the same response and consume the same rate limit.
        const otp = randomInt(100000,1000000).toString();
        for (const c of recent.filter(c => !c.consumedAt)) await tx.orm.public.VerificationCode.where({ id:c.id }).update({ consumedAt:new Date().toISOString() });
        const challenge = await tx.orm.public.VerificationCode.create({ email:PREFIX + username, codeHash:await hashPassword(username + ":" + otp), expiresAt:new Date(Date.now()+600000).toISOString() });
        if (user) await sendSmsCode(RECOVERY_PHONE, otp, "MedFriend admin password recovery (" + username + "). Code: ");
        return { status:200, challengeId:challenge.id, message:"თუ ანგარიში არსებობს, კოდი გაიგზავნა მხოლოდ მთავარ ადმინთან. კოდი მოქმედებს 10 წუთი." };
      }
      if (body.action !== "reset" || typeof body.challengeId !== "number" || !Number.isSafeInteger(body.challengeId) || typeof body.code !== "string" || !/^\d{6}$/.test(body.code)) throw new AdminError(400,"შეიყვანე 6-ნიშნა კოდი");
      if (typeof body.newPassword !== "string" || body.newPassword.length < 12 || body.newPassword.length > 128 || !body.newPassword.trim() || body.newPassword !== body.confirmPassword) throw new AdminError(400,"ახალი პაროლები უნდა ემთხვეოდეს და შეიცავდეს 12–128 სიმბოლოს");
      const challenge = await tx.orm.public.VerificationCode.where({id:body.challengeId,email:PREFIX+username}).first();
      if (!challenge || challenge.consumedAt || Date.parse(challenge.expiresAt) <= Date.now() || challenge.attempts >= 5) throw new AdminError(400,"კოდი ვადაგასული ან გამოყენებულია. მოითხოვე ახალი კოდი.");
      const attempts = challenge.attempts + 1;
      await tx.orm.public.VerificationCode.where({id:challenge.id}).update({attempts});
      if (!user || !await verifyPassword(username+":"+body.code,challenge.codeHash)) return {status:400,error:"კოდი არასწორია"};
      await tx.orm.public.VerificationCode.where({id:challenge.id}).update({consumedAt:new Date().toISOString()});
      await tx.orm.public.AdminUser.where({id:user.id}).update({passwordHash:await hashPassword(body.newPassword)});
      for (const s of await tx.orm.public.AdminSession.where({userId:user.id}).where(s=>s.endedAt.isNull()).all()) await tx.orm.public.AdminSession.where({id:s.id}).update({endedAt:new Date().toISOString()});
      const attempt = await tx.orm.public.AdminLoginAttempt.where({username}).first();
      if (attempt) await tx.orm.public.AdminLoginAttempt.where({id:attempt.id}).delete();
      await audit(tx,identity(user),"recover-password","პაროლი აღდგა მთავარი ადმინის SMS კოდით; ყველა სესია დასრულდა.");
      return {status:200,message:"პაროლი განახლდა. შედი ახალი პაროლით."};
    });
    const response=NextResponse.json(result,{status:result.status,headers:{"Cache-Control":"no-store"}});
    if (body.action === "reset" && result.status === 200) response.cookies.set(COOKIE,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:0});
    return response;
  } catch(error) { return failure(error); }
}
