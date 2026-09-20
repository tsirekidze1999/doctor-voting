import { db } from "../src/prisma/db.ts";

if (process.env.NODE_ENV === "production") throw new Error("Demo seed is for local development only");
const url = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Demo seed requires local PostgreSQL");
try {
  const result = await db.transaction(async (tx) => {
    const existing = await tx.orm.public.Election.orderBy(e => e.id.asc()).first();
    if (existing) return { created: false, electionId: existing.id };
    const election = await tx.orm.public.Election.create({
      title: "წლის საუკეთესო ექიმი",
      description: "სატესტო არჩევნები — აირჩიე შენი ფავორიტი ექიმი და მიეცი ხმა.",
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString(),
      isActive: true,
    });
    for (const doctor of [
      { firstName: "ნინო", lastName: "ბერიძე", specialty: "კარდიოლოგი" },
      { firstName: "გიორგი", lastName: "მაისურაძე", specialty: "ქირურგი" },
      { firstName: "ანა", lastName: "ჩხეტიანი", specialty: "ნევროლოგი" },
    ]) await tx.orm.public.Candidate.create({ electionId: election.id, ...doctor });
    return { created: true, electionId: election.id };
  });
  console.log(JSON.stringify(result));
} finally { await db.close(); }

