import { createHash } from "node:crypto";
import { expectedOrigin } from "./request-origin";
import { normalizePhone } from "./phone";
import { db } from "./prisma/db";

export type VotingTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export class VotingError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function readVoteRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== expectedOrigin(request)) throw new VotingError(403, "მოთხოვნა დაუშვებელია");
  let body: Record<string, unknown>;
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    body = value;
  } catch { throw new VotingError(400, "მოთხოვნის ფორმატი არასწორია"); }
  const phone = normalizePhone(body.phone);
  if (!phone) throw new VotingError(400, "შეიყვანეთ ქართული მობილურის ნომერი, მაგალითად 5XX XXX XXX");
  const { electionId, candidateId } = body;
  if (typeof electionId !== "number" || !Number.isSafeInteger(electionId) || electionId < 1 ||
      typeof candidateId !== "number" || !Number.isSafeInteger(candidateId) || candidateId < 1) {
    throw new VotingError(400, "აირჩიეთ არჩევნები და ექიმი");
  }
  return { body, phone, electionId, candidateId };
}
// Database lock serializes send/verify for an phone across server processes.
// Template interpolations are bound parameters, never SQL string concatenation.
export async function lockPhone(tx: VotingTransaction, phone: string) {
  await tx.execute(db.raw.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${phone}, 0))`
    .returnsRow({ locked: "pg/int4@1" }).build());
}
export async function checkSelection(tx: VotingTransaction, electionId: number, candidateId: number) {
  // SHARE locks permit concurrent voters but prevent election/candidate changes until commit.
  await tx.execute(db.raw.sql`SELECT id FROM public.election WHERE id = ${electionId} FOR SHARE`
    .returnsRow({ id: "pg/int4@1" }).build());
  const election = await tx.orm.public.Election.where({ id: electionId }).first();
  const now = Date.now();
  if (!election || !election.isActive || new Date(election.startsAt).getTime() > now || new Date(election.endsAt).getTime() <= now) {
    throw new VotingError(409, "ამ არჩევნებში ხმის მიცემა ამჟამად დახურულია");
  }
  await tx.execute(db.raw.sql`SELECT id FROM public.candidate WHERE id = ${candidateId} FOR SHARE`
    .returnsRow({ id: "pg/int4@1" }).build());
  const candidate = await tx.orm.public.Candidate.where({ id: candidateId, electionId }).first();
  if (!candidate || !candidate.categoryId) {
    throw new VotingError(400, "ექიმი ამ არჩევნებში ვერ მოიძებნა ან კატეგორია არ აქვს მინიჭებული");
  }
  await tx.execute(db.raw.sql`SELECT id FROM public.category WHERE id = ${candidate.categoryId} FOR SHARE`
    .returnsRow({ id: "pg/int4@1" }).build());
  if (!await tx.orm.public.Category.where({ id: candidate.categoryId, electionId }).first()) {
    throw new VotingError(400, "ექიმის კატეგორია ამ არჩევნებს არ ეკუთვნის");
  }
  return candidate.categoryId;
}
export function voteCodeHash(phone: string, electionId: number, candidateId: number, otp: string, categoryId: number) {
  return createHash("sha256").update(JSON.stringify(["vote-category-v1", phone, electionId, categoryId, candidateId, otp])).digest("hex");
}
export function latestCode(tx: VotingTransaction, phone: string) {
  return tx.orm.public.VerificationCode.where({ phone })
    .orderBy([(code) => code.createdAt.desc(), (code) => code.id.desc()]).first();
}



