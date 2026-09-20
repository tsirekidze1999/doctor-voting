import { db } from "../src/prisma/db.ts";
import { hashPassword } from "../src/admin-password.ts";
import { ALL_PERMISSIONS } from "../src/admin-permissions.ts";
try {
  const users = JSON.parse(process.env.ADMIN_USERS || "[]");
  if (!users.some(u => u.username === "tornike" && u.role === "superadmin")) throw new Error("Owner configuration missing");
  await db.transaction(async tx => {
    for (const user of users) {
      if (await tx.orm.public.AdminUser.where({ username: user.username }).first()) continue;
      await tx.orm.public.AdminUser.create({ username: user.username, name: user.name,
        role: user.role, passwordHash: await hashPassword(user.password),
        permissions: JSON.stringify(user.role === "superadmin" || user.role === "manager" ? ALL_PERMISSIONS : ["manageDoctors", "viewResults"]) });
    }
  });
  console.log("Named accounts imported; existing passwords and permissions were not overwritten.");
} finally { await db.close(); }
