import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/src/prisma/db";
import { checkSelection, latestCode, lockPhone, readVoteRequest, voteCodeHash, VotingError } from "@/src/voting";

export async function POST(request: Request) {
  try {
    const { body, phone, electionId, candidateId } = await readVoteRequest(request);
    const otp = typeof body.otp === "string" ? body.otp.trim() : "";
    const challengeId = body.challengeId;
    if (!/^\d{6}$/.test(otp) || typeof challengeId !== "number" || !Number.isSafeInteger(challengeId) || challengeId < 1) {
      throw new VotingError(400, "მოითხოვეთ კოდი და შეიყვანეთ 6 ციფრი");
    }
    const result = await db.transaction(async (tx) => {
      await lockPhone(tx, phone);
      const categoryId = await checkSelection(tx, electionId, candidateId);
      const code = await latestCode(tx, phone);
      if (!code || code.id !== challengeId) throw new VotingError(400, "გამოიყენეთ ბოლო მოთხოვნილი კოდი");
      if (code.consumedAt) throw new VotingError(400, "ეს OTP კოდი უკვე გამოყენებულია");
      if (code.attempts >= 5) throw new VotingError(429, "ძალიან ბევრი არასწორი მცდელობაა. მოითხოვეთ ახალი კოდი.");
      if (new Date(code.expiresAt).getTime() <= Date.now()) throw new VotingError(400, "OTP კოდს ვადა გაუვიდა. მოითხოვეთ ახალი კოდი.");
      const actual = Buffer.from(voteCodeHash(phone, electionId, candidateId, otp, categoryId), "hex");
      const expected = Buffer.from(code.codeHash, "hex");
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        await tx.orm.public.VerificationCode.where({ id: code.id }).update({ attempts: code.attempts + 1 });
        // Return instead of throw so the failed attempt commits.
        return { status: 400, body: { error: "OTP კოდი არასწორია ან სხვა არჩევანს ეკუთვნის" } };
      }
      if (await tx.orm.public.Vote.where({ electionId, categoryId, phone }).first()) {
        throw new VotingError(409, "ამ ნომრით ამ კატეგორიაში ხმა უკვე მიცემულია");
      }
      await tx.orm.public.VerificationCode.where({ id: code.id }).update({ consumedAt: new Date().toISOString() });
      await tx.orm.public.Vote.create({ electionId, categoryId, candidateId, phone });
      return { status: 200, body: { success: true, message: "მადლობა, თქვენი ხმა მიღებულია" } };
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof VotingError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Vote submission failed", error);
    return NextResponse.json({ error: "ხმის შენახვა ვერ მოხერხდა. სცადეთ ხელახლა." }, { status: 500 });
  }
}



