import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { voteCounts } from "@/src/admin-actions";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const elections = await db.orm.public.Election.orderBy((e) => e.id.desc()).select("id", "title", "description", "startsAt", "endsAt", "isActive", "winnerPublished").all();
    const election = elections.find(item => item.winnerPublished || (item.isActive && new Date(item.startsAt).getTime() <= Date.now() && new Date(item.endsAt).getTime() > Date.now()));
    if (!election) return NextResponse.json({ election: null, categories: [], candidates: [] }, { headers: { "Cache-Control": "no-store" } });
    const publicElection = { ...election, isActive: election.isActive && new Date(election.startsAt).getTime() <= Date.now() && new Date(election.endsAt).getTime() > Date.now() };
    const categories = await db.orm.public.Category.where({ electionId: election.id }).select("id", "name", "position").orderBy([(c) => c.position.asc(), (c) => c.id.asc()]).all();
    const candidates = await db.orm.public.Candidate.where({ electionId: election.id })
      .where((c) => c.categoryId.isNotNull()).select("id", "categoryId", "firstName", "lastName", "specialty", "description", "photoUrl")
      .orderBy((c) => c.id.asc()).all();
    // Only published totals are public; test votes and voter identities stay private.
    const counts = publicElection.winnerPublished ? await db.transaction(tx => voteCounts(tx, election.id)) : null;
    const publicCandidates = candidates.filter(c => categories.some(category => category.id === c.categoryId)).map(candidate => ({ ...candidate, votes: counts ? counts.get(candidate.id)?.votes || 0 : undefined }));
    return NextResponse.json({ election: publicElection, categories, candidates: publicCandidates }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Election loading failed", error);
    return NextResponse.json({ error: "არჩევნების ჩატვირთვა ვერ მოხერხდა" }, { status: 503 });
  }
}


