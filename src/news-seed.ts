import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { db } from "./prisma/db";

export async function ensureDemoNews() {
  await db.transaction(async tx => {
    await tx.execute(db.raw.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(9274201)`.returnsRow({ locked: "pg/int4@1" }).build());
    if (await tx.orm.public.NewsSettings.where({ id: 1 }).first()) return;
    const demos = [["medfriend-award.png", "MedFriend Healthcare Award", "საცდელი სიახლე · ერთად დავაფასოთ ექიმების შრომა და ზრუნვა."], ["medfriend-logo.png", "თქვენი ხმა მნიშვნელოვანია", "საცდელი სიახლე · გაეცანით ექიმებს და მხარი დაუჭირეთ თქვენს რჩეულს."]];
    for (const [position, demo] of demos.entries()) {
      const image = await sharp(await readFile(resolve(process.cwd(), "public", demo[0]))).resize(1280, 720, { fit: "contain", background: "#eef3ff" }).flatten({ background: "#eef3ff" }).jpeg({ quality: 72 }).toBuffer();
      await tx.orm.public.NewsSlide.create({ title: demo[1], description: demo[2], photoUrl: "data:image/jpeg;base64," + image.toString("base64"), position });
    }
    await tx.orm.public.NewsSettings.create({ id: 1, enabled: true });
  });
}
