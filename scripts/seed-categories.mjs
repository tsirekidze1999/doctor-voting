import { db } from "../src/prisma/db.ts";
if (process.env.NODE_ENV === "production") throw new Error("Demo categories are for local development only");
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error("Local database required");
const names = new Map([["სტომატოლოგი", "სტომატოლოგია"], ["ქირურგი", "ქირურგია"], ["კარდიოლოგი", "კარდიოლოგია"], ["ნევროლოგი", "ნევროლოგია"]]);
const additions = [
  ["თამარ", "გელაშვილი", "სტომატოლოგი"], ["ლუკა", "კაპანაძე", "სტომატოლოგი"],
  ["მარიამ", "დოლიძე", "ქირურგი"], ["ლევან", "ლომიძე", "კარდიოლოგი"], ["დავით", "აბაშიძე", "ნევროლოგი"],
];
try {
  await db.transaction(async tx => {
    for (const election of await tx.orm.public.Election.all()) {
      const categories = new Map();
      async function categoryFor(name) {
        if (categories.has(name)) return categories.get(name);
        let category = await tx.orm.public.Category.where({ electionId: election.id, name }).first();
        if (!category) category = await tx.orm.public.Category.create({
          electionId: election.id, name, position: [...names.values()].indexOf(name) + 1,
        });
        categories.set(name, category.id);
        return category.id;
      }
      for (const candidate of await tx.orm.public.Candidate.where({ electionId: election.id }).all()) {
        if (candidate.categoryId) continue;
        const categoryId = await categoryFor(names.get(candidate.specialty) || candidate.specialty || "სხვა სპეციალობა");
        await tx.orm.public.Candidate.where({ id: candidate.id }).update({ categoryId });
      }
      // Only the known demo election receives additional fictional candidates.
      if (election.description?.startsWith("სატესტო არჩევნები")) {
        for (const [firstName, lastName, specialty] of additions) {
          if (await tx.orm.public.Candidate.where({ electionId: election.id, firstName, lastName }).first()) continue;
          await tx.orm.public.Candidate.create({
            electionId: election.id, categoryId: await categoryFor(names.get(specialty)),
            firstName, lastName, specialty, description: "სატესტო კანდიდატი",
          });
        }
      }
      for (const vote of await tx.orm.public.Vote.where({ electionId: election.id }).all()) {
        const candidate = await tx.orm.public.Candidate.where({ id: vote.candidateId, electionId: election.id }).first();
        if (!candidate?.categoryId) throw new Error("Cannot categorize existing vote " + vote.id);
        if (vote.categoryId && vote.categoryId !== candidate.categoryId) throw new Error("Vote category mismatch");
        if (!vote.categoryId) await tx.orm.public.Vote.where({ id: vote.id }).update({ categoryId: candidate.categoryId });
      }
    }
  });
  console.log("Categories assigned; existing votes preserved.");
} finally { await db.close(); }

