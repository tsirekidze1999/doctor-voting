import assert from "node:assert/strict";
import { createHash, randomInt } from "node:crypto";
import { readFile } from "node:fs/promises";
import { db } from "../src/prisma/db.ts";

const base = "http://localhost:3000";
const url = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Local test database required");
if (process.env.NODE_ENV === "production" || (process.env.SMS_PROVIDER ?? "console") !== "console") throw new Error("Console SMS mode required");
const elections = [], categories = [], candidates = [], phones = [];
let checks = 0;
function phone() {
  const result = "+9955" + randomInt(0, 100_000_000).toString().padStart(8, "0");
  phones.push(result);
  return result;
}
async function post(path, body, headers = {}) {
  const response = await fetch(base + path, { method: "POST",
    headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
function check(value, expected, label) { assert.deepEqual(value, expected, label); checks++; console.log("PASS " + label); }
async function fixture(electionId, candidateId, number = phone(), overrides = {}) {
  const otp = "456789";
  const candidate = await db.orm.public.Candidate.where({ id: candidateId }).first();
  const code = await db.orm.public.VerificationCode.create({
    phone: number,
    codeHash: createHash("sha256").update(JSON.stringify(["vote-category-v1", number, electionId, candidate.categoryId, candidateId, otp])).digest("hex"),
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    ...overrides,
  });
  return { phone: number, electionId, candidateId, otp, challengeId: code.id };
}
async function votes(number) {
  const result = await db.orm.public.Vote.where({ phone: number }).aggregate(a => ({ total: a.count() }));
  return result.total;
}
try {
  for (let i = 0; i < 2; i++) {
    const e = await db.orm.public.Election.create({
      title: "AUTOMATED SMS TEST " + i, isActive: true,
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 600_000).toISOString(),
    });
    elections.push(e.id);
    const category = await db.orm.public.Category.create({ electionId: e.id, name: "Test category " + i, position: 1 });
    categories.push(category.id);
    for (let j = 0; j < 2; j++) {
      const c = await db.orm.public.Candidate.create({ electionId: e.id, categoryId: category.id, firstName: "Test", lastName: String(j) });
      candidates.push(c.id);
    }
  }
  const [eid, otherElection] = elections, [cid, otherCandidate, foreignCandidate] = candidates;
  const p = phone();
  const send = await post("/api/send-otp", { phone: p.slice(4), electionId: eid, candidateId: cid });
  check(send.status, 200, "request code using local phone format");
  check(send.body.phone, p, "server normalizes Georgian phone");
  check(send.body.delivery, "console", "no actual SMS sent");
  check("otp" in send.body, false, "OTP not exposed in API response");
  let otp;
  for (let retry = 0; retry < 20 && !otp; retry++) {
  await new Promise(resolve => setTimeout(resolve, 100));
  const logs = (await readFile(".next/dev/logs/next-development.log", "utf8")).split("\n");
  for (const line of logs) {
    try {
      const entry = JSON.parse(line);
      if (!entry.message?.includes("[TEST SMS]")) continue;
      const payload = JSON.parse(entry.message.slice(entry.message.indexOf("[TEST SMS]") + 10).trim());
      const record = typeof payload === "string" ? JSON.parse(payload) : payload;
      if (record.phone === p) otp = record.otp;
    } catch {}
  }
  }
  assert.ok(otp, "Find generated test OTP in server log");
  const request = { phone: p, electionId: eid, candidateId: cid, otp, challengeId: send.body.challengeId };
  check((await post("/api/send-otp", { ...request, phone: phone() })).status, 200, "another category can request a code without waiting");
  check((await post("/api/verify-otp", { ...request, otp: "000000" })).status, 400, "wrong code rejected");
  check(await votes(p), 0, "wrong code creates no vote");
  check((await post("/api/verify-otp", { ...request, candidateId: otherCandidate })).status, 400, "code bound to chosen doctor");
  check((await post("/api/verify-otp", { ...request, phone: p.slice(4) })).status, 200, "correct code records vote");
  check(await votes(p), 1, "exactly one vote in database");
  check((await post("/api/verify-otp", request)).status, 400, "consumed OTP rejected");
  const duplicate = await fixture(eid, otherCandidate, p);
  check((await post("/api/verify-otp", duplicate)).status, 409, "new OTP cannot vote twice");
  check(await votes(p), 1, "duplicate leaves vote count unchanged");
  const separate = await fixture(otherElection, foreignCandidate, p);
  check((await post("/api/verify-otp", separate)).status, 200, "same number may vote in another election");

  const parallel = await fixture(eid, cid);
  const results = await Promise.all(Array.from({ length: 6 }, () => post("/api/verify-otp", parallel)));
  check(results.filter(r => r.status === 200).length, 1, "parallel submissions succeed only once");
  check(await votes(parallel.phone), 1, "parallel submissions create exactly one vote");

  const attempts = await fixture(eid, cid);
  await Promise.all(Array.from({ length: 8 }, () => post("/api/verify-otp", { ...attempts, otp: "000000" })));
  const attemptsRow = await db.orm.public.VerificationCode.where({ id: attempts.challengeId }).first();
  check(attemptsRow.attempts, 5, "parallel wrong codes stop at five attempts");
  check((await post("/api/verify-otp", attempts)).status, 429, "correct code blocked after attempt limit");
  check(await votes(attempts.phone), 0, "locked challenge creates no vote");

  const expired = await fixture(eid, cid, phone(), { expiresAt: new Date(Date.now() - 1000).toISOString() });
  check((await post("/api/verify-otp", expired)).status, 400, "expired code rejected");
  const stale = await fixture(eid, cid);
  await fixture(eid, cid, stale.phone);
  check((await post("/api/verify-otp", stale)).status, 400, "superseded code rejected");

  const invalidCandidate = await fixture(eid, cid);
  check((await post("/api/verify-otp", { ...invalidCandidate, candidateId: foreignCandidate })).status, 400, "candidate from other election rejected");
  check((await db.orm.public.VerificationCode.where({ id: invalidCandidate.challengeId }).first()).consumedAt, null, "rejected selection does not consume code");

  const closed = await fixture(eid, cid);
  await db.orm.public.Election.where({ id: eid }).update({ isActive: false });
  check((await post("/api/verify-otp", closed)).status, 409, "deactivated election rejects vote");
  await db.orm.public.Election.where({ id: eid }).update({ isActive: true, endsAt: new Date(Date.now() - 1000).toISOString() });
  check((await post("/api/verify-otp", closed)).status, 409, "finished election rejects vote");
  await db.orm.public.Election.where({ id: eid }).update({
    startsAt: new Date(Date.now() + 60_000).toISOString(),
    endsAt: new Date(Date.now() + 600_000).toISOString(),
  });
  check((await post("/api/verify-otp", closed)).status, 409, "future election rejects vote");
  check((await post("/api/verify-otp", { phone: p, electionId: eid, candidateId: cid })).status, 400, "OTP cannot be omitted");
  check((await post("/api/send-otp", { phone: {}, electionId: eid, candidateId: cid })).status, 400, "invalid phone type handled");
  check((await post("/api/send-otp", { phone: "+15551234567", electionId: eid, candidateId: cid })).status, 400, "foreign number rejected");
  check((await post("/api/send-otp", { phone: p, electionId: eid, candidateId: cid }, { Origin: "https://example.invalid" })).status, 403, "cross-origin submission rejected");
  const publicData = await (await fetch(base + "/api/election")).json();
  const json = JSON.stringify(publicData);
  check(/codeHash|consumedAt|"votes"|"phone"|"email"/.test(json), false, "public endpoint excludes votes and personal data");
  let uniqueRejected = false;
  try { await db.orm.public.Vote.create({ electionId: otherElection, categoryId: categories[1], candidateId: foreignCandidate, phone: p }); }
  catch { uniqueRejected = true; }
  check(uniqueRejected, true, "database unique constraint rejects duplicate");
  console.log("All " + checks + " integration checks passed.");
} finally {
  // Only remove fixtures created by this run; never touch user/demo votes.
  await db.transaction(async tx => {
    for (const p of phones) {
      for (const row of await tx.orm.public.VerificationCode.where({ phone: p }).all()) await tx.orm.public.VerificationCode.where({ id: row.id }).delete();
      for (const row of await tx.orm.public.Vote.where({ phone: p }).all()) await tx.orm.public.Vote.where({ id: row.id }).delete();
    }
    for (const id of candidates) await tx.orm.public.Candidate.where({ id }).delete();
    for (const id of categories) await tx.orm.public.Category.where({ id }).delete();
    for (const id of elections) await tx.orm.public.Election.where({ id }).delete();
  });
  await db.close();
}




