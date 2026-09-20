import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { AdminError, audit, authenticate, failure, identity, lockAdmin, readBody, sameOrigin } from "@/src/admin-auth";
import { ACTION_PERMISSION, ACTION_LABELS, ALL_PERMISSIONS, allowed, type Permission } from "@/src/admin-permissions";
import { executeAction, fingerprint, normalizeAction, positive, text, voteCounts } from "@/src/admin-actions";
import { hashPassword } from "@/src/admin-password";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const result = await db.transaction(async tx => {
      const { admin } = await authenticate(request, tx);
      const elections = [];
      for (const e of await tx.orm.public.Election.orderBy(e => e.id.desc()).all()) {
        const categories = await tx.orm.public.Category.where({ electionId: e.id }).orderBy(c => c.position.asc()).all();
        const candidates = await tx.orm.public.Candidate.where({ electionId: e.id }).all();
        const counts = allowed(admin, "viewResults") ? await voteCounts(tx, e.id) : null;
        elections.push({ ...e, categories: categories.map(c => ({ ...c, candidates: candidates.filter(d => d.categoryId === c.id).map(d => ({ ...d, ...(counts?.get(d.id) || (counts ? { votes: 0, testVotes: 0 } : {})) })) })),
          totals: { candidates: candidates.length, votes: counts ? [...counts.values()].reduce((sum, c) => sum + c.votes, 0) : null } });
      }
      const approvals = (await tx.orm.public.AdminApproval.orderBy(a => a.id.desc()).limit(200).all()).filter(a => a.userId === admin.id || allowed(admin, ACTION_PERMISSION[a.action]));
      const users = allowed(admin, "manageAdmins") ? (await tx.orm.public.AdminUser.orderBy(u => u.id.asc()).all()).map(identity) : [];
      const history = allowed(admin, "viewAudit") ? await tx.orm.public.AdminAudit.orderBy(a => a.id.desc()).limit(150).all() : [];
      const sessions = allowed(admin, "viewAudit") ? await tx.orm.public.AdminSession.select("id", "userId", "createdAt", "lastSeenAt", "endedAt", "expiresAt").orderBy(s => s.id.desc()).limit(100).all() : [];
      const names = allowed(admin, "viewAudit") ? await tx.orm.public.AdminUser.select("id", "name").all() : [];
      const voters = allowed(admin, "viewVoterDetails") ? (await tx.orm.public.Vote.orderBy(v => v.id.desc()).limit(500).all()).map(v => ({ id: v.id, electionId: v.electionId, categoryId: v.categoryId, candidateId: v.candidateId, phone: v.phone, createdAt: v.createdAt })) : [];
      return { admin, elections, approvals, users, history, sessions: sessions.map(s => ({ ...s, name: names.find(n => n.id === s.userId)?.name || "ადმინი" })), voters };
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await readBody(request);
    const result = await db.transaction(async tx => {
      await lockAdmin(tx);
      const { admin } = await authenticate(request, tx);
      if (body.action === "save-user") {
        if (!allowed(admin, "manageAdmins")) throw new AdminError(403, "ადმინების მართვის უფლება არ გაქვს");
        const existing = body.id ? await tx.orm.public.AdminUser.where({ id: positive(body.id) }).first() : null;
        if (body.id && !existing) throw new AdminError(404, "ადმინი ვერ მოიძებნა");
        if (existing?.id === admin.id) throw new AdminError(403, "საკუთარი უფლებები ამ ფორმით ვერ შეიცვლება");
        if (existing?.role === "superadmin") throw new AdminError(403, "მთავარი ადმინის ანგარიში დაცულია");
        if (admin.role !== "superadmin" && existing?.role === "manager") throw new AdminError(403, "მენეჯერის ანგარიშს მთავარი ადმინი მართავს");
        const username = text(body.username, "მომხმარებელი", false, 40).toLowerCase();
        if (!/^[a-z0-9_.-]{3,40}$/.test(username)) throw new AdminError(400, "მომხმარებლის სახელი: 3–40 ლათინური ასო ან ციფრი");
        const duplicate = await tx.orm.public.AdminUser.where({ username }).first();
        if (duplicate && duplicate.id !== existing?.id) throw new AdminError(409, "მომხმარებელი უკვე არსებობს");
        const name = text(body.name, "სახელი", false, 80);
        if (!Array.isArray(body.permissions) || body.permissions.some(p => !ALL_PERMISSIONS.includes(p as Permission))) throw new AdminError(400, "უფლებები არასწორია");
        const permissions = [...new Set(body.permissions)] as Permission[];
        if (permissions.some(p => !allowed(admin, p))) throw new AdminError(403, "სხვას მხოლოდ საკუთარი უფლებები შეგიძლია მიანიჭო");
        if (existing && identity(existing).permissions.some(p => !allowed(admin, p))) throw new AdminError(403, "ამ ანგარიშის მართვა შენს უფლებებს აღემატება");
        if (typeof body.active !== "boolean") throw new AdminError(400, "მიუთითე ანგარიშის სტატუსი");
        const password = body.password;
        if ((!existing || password) && (typeof password !== "string" || password.length < 12 || password.length > 128)) throw new AdminError(400, "ახალი პაროლი უნდა შეიცავდეს 12–128 სიმბოლოს");
        const values = { username, name, permissions: JSON.stringify(permissions), active: body.active };
        if (existing) {
          await tx.orm.public.AdminUser.where({ id: existing.id }).update({ ...values, ...(password ? { passwordHash: await hashPassword(password as string) } : {}) });
          if (!body.active || password) for (const s of await tx.orm.public.AdminSession.where({ userId: existing.id }).where(s => s.endedAt.isNull()).all()) await tx.orm.public.AdminSession.where({ id: s.id }).update({ endedAt: new Date().toISOString() });
        } else await tx.orm.public.AdminUser.create({ ...values, passwordHash: await hashPassword(password as string), role: "moderator" });
        await audit(tx, admin, "save-user", name + " (" + username + "): " + (body.active ? "აქტიური" : "გამორთული") + "; უფლებები: " + permissions.join(", "));
        return { message: "ანგარიში და უფლებები შენახულია" };
      }
      if (body.action === "approve" || body.action === "reject") {
        const approval = await tx.orm.public.AdminApproval.where({ id: positive(body.id) }).first();
        if (!approval || approval.status !== "pending") throw new AdminError(409, "მოთხოვნა უკვე დამუშავებულია");
        if (!allowed(admin, ACTION_PERMISSION[approval.action])) throw new AdminError(403, "ამ მოქმედების დადასტურების უფლება არ გაქვს");
        if (approval.userId === admin.id) throw new AdminError(403, "საკუთარ მოთხოვნას სხვა უფლებამოსილი ადმინი ადასტურებს");
        if (body.action === "approve") {
          if (!await tx.orm.public.AdminUser.where({ id: approval.userId, active: true }).first()) throw new AdminError(409, "მოთხოვნის ავტორის ანგარიში გამორთულია");
          const data = normalizeAction(JSON.parse(approval.payload));
          if (await fingerprint(tx, data) !== approval.fingerprint) throw new AdminError(409, "მონაცემები შეიცვალა. უარყავი ძველი მოთხოვნა და მოითხოვე ახალი.");
          await executeAction(tx, admin, data);
        }
        await tx.orm.public.AdminApproval.where({ id: approval.id }).update({ status: body.action === "approve" ? "approved" : "rejected", reviewerName: admin.name, reviewedAt: new Date().toISOString() });
        await audit(tx, admin, body.action, "#" + approval.id + " · " + approval.actorName + " · " + ACTION_LABELS[approval.action]);
        return { message: body.action === "approve" ? "მოთხოვნა დადასტურდა და შესრულდა" : "მოთხოვნა უარყოფილია" };
      }
      const action = typeof body.action === "string" ? body.action : "";
      const permission = ACTION_PERMISSION[action];
      if (!Object.hasOwn(ACTION_PERMISSION, action) || !permission) throw new AdminError(400, "უცნობი მოქმედება");
      const data = normalizeAction(body);
      if (!allowed(admin, permission)) {
        const hash = await fingerprint(tx, data);
        const payload = JSON.stringify(data);
        if (await tx.orm.public.AdminApproval.where({ userId: admin.id, status: "pending", payload }).first()) throw new AdminError(409, "ასეთი მოთხოვნა უკვე ელოდება დადასტურებას");
        await tx.orm.public.AdminApproval.create({ userId: admin.id, actorName: admin.name, electionId: data.electionId as number || 0, action, payload, fingerprint: hash });
        await audit(tx, admin, "request", ACTION_LABELS[action] + " · " + (data.title || "არჩევნები #" + data.electionId));
        return { pending: true, message: "მოთხოვნა გაგზავნილია დასამტკიცებლად. ცვლილება ჯერ არ შესრულებულა." };
      }
      await executeAction(tx, admin, data);
      return { message: "ცვლილება შენახულია" };
    });
    return NextResponse.json(result);
  } catch (error) { return failure(error); }
}
