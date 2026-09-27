import sharp from "sharp";
import { readFile } from "node:fs/promises";
// Runs once only: later deploys must never re-enable a disabled slideshow or
// recreate slides deliberately deleted by an administrator.
export async function seedNews(db) {
  await db.transaction(async tx=>{
    await tx.execute(db.raw.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(9274201)`.returnsRow({locked:"pg/int4@1"}).build());
    if(await tx.orm.public.NewsSettings.where({id:1}).first())return;
    const demos=[
      {file:"medfriend-award.png",title:"MedFriend Healthcare Award",description:"საცდელი სიახლე · ერთად დავაფასოთ ექიმების შრომა და ზრუნვა."},
      {file:"medfriend-logo.png",title:"თქვენი ხმა მნიშვნელოვანია",description:"საცდელი სიახლე · გაეცანით ექიმებს და მხარი დაუჭირეთ თქვენს რჩეულს თითოეულ კატეგორიაში."},
    ];
    for(const [position,demo] of demos.entries()){
      const image=await sharp(await readFile(new URL("../public/"+demo.file,import.meta.url))).resize(1280,720,{fit:"contain",background:"#eef3ff"}).flatten({background:"#eef3ff"}).jpeg({quality:72}).toBuffer();
      await tx.orm.public.NewsSlide.create({title:demo.title,description:demo.description,photoUrl:"data:image/jpeg;base64,"+image.toString("base64"),position});
    }
    await tx.orm.public.NewsSettings.create({id:1,enabled:true});
  });
}
