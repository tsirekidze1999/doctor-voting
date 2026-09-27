import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { voteCounts } from "@/src/admin-actions";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const elections = await db.orm.public.Election.orderBy((e) => e.id.desc()).select("id", "title", "description", "startsAt", "endsAt", "isActive", "winnerPublished").all();
    const params = new URL(request.url).searchParams;
    const mode = params.get("mode") || "default";
    const rawId = params.get("election");
    if (!["default", "vote", "winners"].includes(mode) || (rawId !== null && (!/^[1-9]\d{0,9}$/.test(rawId) || !Number.isSafeInteger(Number(rawId)))))
      return NextResponse.json({ error: "არასწორი არჩევნების მოთხოვნა" }, { status: 400 });
    const active = (item: typeof elections[number]) => item.isActive && !item.winnerPublished && Date.parse(item.startsAt) <= Date.now() && Date.parse(item.endsAt) > Date.now();
    const visible = (item: typeof elections[number]) => mode === "winners" ? item.winnerPublished : mode === "vote" ? active(item) : item.winnerPublished || active(item);
    const archive = mode === "winners" ? elections.filter(item => item.winnerPublished).map(({id,title,endsAt}) => ({id,title,endsAt})) : [];
    const election = rawId ? elections.find(item => item.id === Number(rawId) && visible(item)) : elections.find(visible);
    if (!election) return NextResponse.json({ election: null, categories: [], candidates: [], archive }, { status: rawId ? 404 : 200, headers: { "Cache-Control": "no-store" } });
    const publicElection = { ...election, isActive: election.isActive && new Date(election.startsAt).getTime() <= Date.now() && new Date(election.endsAt).getTime() > Date.now() };
    const categories = await db.orm.public.Category.where({ electionId: election.id }).select("id", "name", "position").orderBy([(c) => c.position.asc(), (c) => c.id.asc()]).all();
    const candidates = await db.orm.public.Candidate.where({ electionId: election.id })
      .where((c) => c.categoryId.isNotNull()).select("id", "categoryId", "firstName", "lastName", "specialty", "description", "photoUrl")
      .orderBy((c) => c.id.asc()).all();
    // Only published totals are public; test votes and voter identities stay private.
    const counts = publicElection.winnerPublished ? await db.transaction(tx => voteCounts(tx, election.id)) : null;
    const publicCandidates = candidates.filter(c => categories.some(category => category.id === c.categoryId)).map(candidate => ({ ...candidate, votes: counts ? counts.get(candidate.id)?.votes || 0 : undefined }));
    return NextResponse.json({ election: publicElection, categories, candidates: publicCandidates, archive }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Election loading failed", error);
    return NextResponse.json({ error: "არჩევნების ჩატვირთვა ვერ მოხერხდა" }, { status: 503 });
  }
}


