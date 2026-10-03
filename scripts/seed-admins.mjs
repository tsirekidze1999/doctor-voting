import { seedNews } from "./seed-news.mjs";
import { db } from "../src/prisma/db.ts";
import { hashPassword } from "../src/admin-password.ts";
import { ALL_PERMISSIONS } from "../src/admin-permissions.ts";
try {
  const users = JSON.parse(process.env.ADMIN_USERS || "[]");
  if (!users.some(u => u.username === "tornike" && u.role === "superadmin")) throw new Error("Owner configuration missing");
  await db.transaction(async tx => {
    const firstSupportSetup = !await tx.orm.public.SupportSettings.where({id:1}).first();
    if(firstSupportSetup) {
    await tx.orm.public.SupportSettings.create({id:1,enabled:false});
    for (const username of ["mariam","tako"]) {
      const existing = await tx.orm.public.AdminUser.where({username,role:"manager"}).first();
      if(existing) await tx.orm.public.AdminUser.where({id:existing.id}).update({role:"headadmin"});
    }
    }
    for (const user of users) {
      if (await tx.orm.public.AdminUser.where({ username: user.username }).first()) continue;
      await tx.orm.public.AdminUser.create({ username: user.username, name: user.name,
        role: ["mariam","tako"].includes(user.username) ? "headadmin" : user.role, passwordHash: await hashPassword(user.password),
        permissions: JSON.stringify(user.role === "superadmin" || user.role === "manager" ? ALL_PERMISSIONS : ["manageDoctors", "viewResults"]) });
    }
  });
  await seedNews(db);
  console.log("Named accounts imported; existing passwords and permissions were not overwritten.");
} finally { await db.close(); }
