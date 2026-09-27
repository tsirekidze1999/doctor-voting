import { normalizePhoto } from "./doctor-photo";
import { createHash } from "node:crypto";
import { db } from "./prisma/db";
import { AdminError, audit, type Tx } from "./admin-auth";
import { ACTION_LABELS, type AdminIdentity } from "./admin-permissions";
export type Body = Record<string, unknown>;
export function positive(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new AdminError(400, "ჩანაწერი სწორად აირჩიე");
  return value;
}
export function text(value: unknown, label: string, optional = false, max = 200) {
  if (optional && (value === undefined || value === null || value === "")) return "";
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new AdminError(400, "შეავსე სწორად: " + label);
  return value.trim();
}
export async function normalizeAction(body: Body) {
  const action = text(body.action, "მოქმედება");
  const data: Body = { action };
  if (action !== "create") data.electionId = positive(body.electionId);
  if (["create", "edit-election"].includes(action)) {
    data.title = text(body.title, "სათაური"); data.description = text(body.description, "აღწერა", true, 2000);
    const start = typeof body.startsAt === "string" ? Date.parse(body.startsAt) : NaN;
    const end = typeof body.endsAt === "string" ? Date.parse(body.endsAt) : NaN;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new AdminError(400, "დასრულება დაწყების შემდეგ უნდა იყოს");
    data.startsAt = new Date(start).toISOString(); data.endsAt = new Date(end).toISOString();
  }
  if (["add-category", "update-category"].includes(action)) data.name = text(body.name, "კატეგორია", false, 100);
  if (["update-category", "delete-category", "add-candidate", "update-candidate"].includes(action)) data.categoryId = positive(body.categoryId);
  if (["update-candidate", "delete-candidate"].includes(action)) data.candidateId = positive(body.candidateId);
  if (["add-candidate", "update-candidate"].includes(action)) {
    data.firstName = text(body.firstName, "სახელი", false, 80); data.lastName = text(body.lastName, "გვარი", false, 80);
    data.specialty = text(body.specialty, "სპეციალობა", true, 150); data.description = text(body.description, "აღწერა", true, 2000);
    const photo = await normalizePhoto(body.photoUrl);
    data.photoUrl = photo;
  }
  return data;
}
export async function electionFor(tx: Tx, data: Body) {
  const id = positive(data.electionId);
  await tx.execute(db.raw.sql`SELECT id FROM public.election WHERE id = ${id} FOR UPDATE`.returnsRow({ id: "pg/int4@1" }).build());
  const election = await tx.orm.public.Election.where({ id }).first();
  if (!election) throw new AdminError(404, "არჩევნები ვერ მოიძებნა");
  return election;
}
export async function fingerprint(tx: Tx, data: Body) {
  if (data.action === "create") return "new";
  const e = await electionFor(tx, data);
  return createHash("sha256").update(JSON.stringify([e.id, e.updatedAt, e.isActive, e.winnerPublished])).digest("hex");
}
export async function executeAction(tx: Tx, admin: AdminIdentity, data: Body) {
  const action = data.action as string;
  if (action === "create") {
    const e = await tx.orm.public.Election.create({ title: data.title as string, description: data.description as string || null,
      startsAt: data.startsAt as string, endsAt: data.endsAt as string, isActive: false });
    await audit(tx, admin, action, e.title + " (#" + e.id + ")");
    return;
  }
  const election = await electionFor(tx, data);
  const id = election.id;
  if (action === "edit-election") {
    await tx.orm.public.Election.where({ id }).update({ title: data.title as string, description: data.description as string || null,
      startsAt: data.startsAt as string, endsAt: data.endsAt as string, winnerPublished: false });
  } else if (action === "start") {
    if (Date.parse(election.endsAt) <= Date.now()) throw new AdminError(409, "დასრულების დრო გასულია. ჯერ შეცვალე თარიღები.");
    if (!await tx.orm.public.Candidate.where({ electionId: id }).where(c => c.categoryId.isNotNull()).first()) throw new AdminError(409, "ჯერ დაამატე კატეგორია და ექიმები");
    if (election.winnerPublished) throw new AdminError(409, "ჯერ დამალე გამოქვეყნებული შედეგები");
    await tx.orm.public.Election.where({ id }).update({ isActive: true });
  } else if (action === "stop") {
    await tx.orm.public.Election.where({ id }).update({ isActive: false });
  } else if (action === "publish") {
    if (election.isActive && Date.parse(election.endsAt) > Date.now()) throw new AdminError(409, "საბოლოო შედეგებისთვის ჯერ შეაჩერე არჩევნები");
    await tx.orm.public.Election.where({ id }).update({ isActive: false, winnerPublished: true });
  } else if (action === "unpublish") {
    await tx.orm.public.Election.where({ id }).update({ winnerPublished: false });
  } else if (action === "delete-election") {
    if (election.isActive) throw new AdminError(409, "წაშლამდე შეაჩერე არჩევნები");
    if (await tx.orm.public.Vote.where({ electionId: id }).first()) throw new AdminError(409, "ხმების მქონე არჩევნები ინახება არქივისთვის და ვერ წაიშლება");
    for (const c of await tx.orm.public.Candidate.where({ electionId: id }).all()) await tx.orm.public.Candidate.where({ id: c.id }).delete();
    for (const c of await tx.orm.public.Category.where({ electionId: id }).all()) await tx.orm.public.Category.where({ id: c.id }).delete();
    for (const s of await tx.orm.public.Sponsor.where({ electionId: id }).all()) await tx.orm.public.Sponsor.where({ id: s.id }).delete();
    await tx.orm.public.Election.where({ id }).delete();
  } else {
    if (data.categoryId && !await tx.orm.public.Category.where({ id: positive(data.categoryId), electionId: id }).first()) throw new AdminError(400, "კატეგორია ამ არჩევნებს არ ეკუთვნის");
    const existing = data.candidateId ? await tx.orm.public.Candidate.where({ id: positive(data.candidateId), electionId: id }).first() : null;
    if (data.candidateId && !existing) throw new AdminError(404, "ექიმი ვერ მოიძებნა");
    if (action === "add-category" || action === "update-category") {
      const duplicate = await tx.orm.public.Category.where({ electionId: id, name: data.name as string }).first();
      if (duplicate && duplicate.id !== data.categoryId) throw new AdminError(409, "ასეთი კატეგორია უკვე არსებობს");
      if (action === "add-category") await tx.orm.public.Category.create({ electionId: id, name: data.name as string });
      else await tx.orm.public.Category.where({ id: positive(data.categoryId) }).update({ name: data.name as string });
    } else if (action === "delete-category") {
      const categoryId = positive(data.categoryId);
      if (await tx.orm.public.Candidate.where({ categoryId }).first() || await tx.orm.public.Vote.where({ categoryId }).first()) throw new AdminError(409, "კატეგორია ცარიელი უნდა იყოს");
      await tx.orm.public.Category.where({ id: categoryId }).delete();
    } else if (action === "delete-candidate") {
      if (await tx.orm.public.Vote.where({ candidateId: existing!.id }).first()) throw new AdminError(409, "ხმების მქონე ექიმი ვერ წაიშლება");
      await tx.orm.public.Candidate.where({ id: existing!.id }).delete();
    } else if (action === "add-candidate" || action === "update-candidate") {
      if (existing && existing.categoryId !== data.categoryId && await tx.orm.public.Vote.where({ candidateId: existing.id }).first()) throw new AdminError(409, "ხმების მიღების შემდეგ კატეგორია ვერ შეიცვლება");
      const values = { categoryId: positive(data.categoryId), firstName: data.firstName as string, lastName: data.lastName as string,
        specialty: data.specialty as string || null, description: data.description as string || null, photoUrl: data.photoUrl as string || null };
      if (existing) await tx.orm.public.Candidate.where({ id: existing.id }).update(values);
      else await tx.orm.public.Candidate.create({ electionId: id, ...values });
    } else throw new AdminError(400, "უცნობი მოქმედება");
    await tx.orm.public.Election.where({ id }).update({ winnerPublished: false, updatedAt: new Date().toISOString() });
  }
  await audit(tx, admin, action, election.title + " (#" + id + ") · " + (data.firstName || data.name || ACTION_LABELS[action]));
}
export async function voteCounts(tx: Tx, electionId: number) {
  const all = await tx.orm.public.Vote.where({ electionId }).groupBy("candidateId").aggregate(a => ({ total: a.count() }));
  const tests = await tx.orm.public.Vote.where({ electionId }).where(v => v.phone.like("TEST:%")).groupBy("candidateId").aggregate(a => ({ total: a.count() }));
  return new Map(all.map(row => [row.candidateId, { votes: row.total - (tests.find(t => t.candidateId === row.candidateId)?.total || 0), testVotes: tests.find(t => t.candidateId === row.candidateId)?.total || 0 }]));
}
