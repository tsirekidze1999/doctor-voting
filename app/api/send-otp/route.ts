import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { db } from "@/src/prisma/db";
import { checkSelection, lockPhone, readVoteRequest, voteCodeHash, VotingError } from "@/src/voting";
import { isSmsEnabled, sendSmsCode } from "@/src/sms";

export async function POST(request: Request) {
  try {
    const { phone, electionId, candidateId } = await readVoteRequest(request);
    if (!isSmsEnabled()) throw new VotingError(503, "SMS სერვისი ჯერ არ არის ჩართული");
    const otp = randomInt(100000, 1000000).toString();
    const result = await db.transaction(async (tx) => {
      await lockPhone(tx, phone);
      const categoryId = await checkSelection(tx, electionId, candidateId);
      const code = await tx.orm.public.VerificationCode.create({
        phone, codeHash: voteCodeHash(phone, electionId, candidateId, otp, categoryId),
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      // Console adapter only. Real SMS delivery will require provider error
      // handling and delivery-state tracking before production activation.
      const delivery = await sendSmsCode(phone, otp);
      return { code, delivery };
    });
    return NextResponse.json({
      success: true, challengeId: result.code.id, phone,
      delivery: result.delivery.delivery, retryAfterSeconds: 0,
      message: result.delivery.delivery === "console" ? "სატესტო კოდი მზადაა. ნახეთ ტერმინალში." : "ვერიფიკაციის კოდი SMS-ით გამოგეგზავნათ.",
    });
  } catch (error) {
    if (error instanceof VotingError) return NextResponse.json({ error: error.message }, {
      status: error.status, headers: error.status === 429 ? { "Retry-After": "60" } : undefined,
    });
    console.error("OTP creation failed", error);
    return NextResponse.json({ error: "კოდის შექმნა ვერ მოხერხდა" }, { status: 500 });
  }
}


