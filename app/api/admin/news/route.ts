import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { AdminError, authenticate, audit, failure, lockAdmin, readBody, sameOrigin } from "@/src/admin-auth";
import { allowed } from "@/src/admin-permissions";
import { positive, text } from "@/src/admin-actions";
import { normalizePhoto } from "@/src/doctor-photo";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const data = await db.transaction(async tx => {
      const {admin} = await authenticate(request, tx);
      if (!allowed(admin,"manageNews")) throw new AdminError(403,"სიახლეების მართვის უფლება არ გაქვს");
      return {enabled:(await tx.orm.public.NewsSettings.where({id:1}).first())?.enabled ?? false,
        slides:await tx.orm.public.NewsSlide.orderBy(s=>s.position.asc()).orderBy(s=>s.id.asc()).all()};
    });
    return NextResponse.json(data,{headers:{"Cache-Control":"no-store"}});
  } catch(error) {return failure(error);}
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body=await readBody(request,450000);
    await db.transaction(async tx=>{
      await lockAdmin(tx);
      const {admin}=await authenticate(request,tx);
      if(!allowed(admin,"manageNews"))throw new AdminError(403,"სიახლეების მართვის უფლება არ გაქვს");
      if(body.action==="toggle") {
        if(typeof body.enabled!=="boolean")throw new AdminError(400,"აირჩიე მდგომარეობა");
        if(body.enabled&&!await tx.orm.public.NewsSlide.first())throw new AdminError(409,"ჯერ დაამატე ერთი სიახლე მაინც");
        const existing=await tx.orm.public.NewsSettings.where({id:1}).first();
        if(existing)await tx.orm.public.NewsSettings.where({id:1}).update({enabled:body.enabled});
        else await tx.orm.public.NewsSettings.create({id:1,enabled:body.enabled});
        await audit(tx,admin,"toggle-news",body.enabled?"ჩართულია":"გამორთულია");
      } else if(body.action==="save"||body.action==="delete") {
        const id=body.id===undefined?null:positive(body.id);
        if(id&&!await tx.orm.public.NewsSlide.where({id}).first())throw new AdminError(404,"სიახლე ვერ მოიძებნა");
        if(body.action==="delete") {
          if(!id)throw new AdminError(400,"აირჩიე სიახლე");
          await tx.orm.public.NewsSlide.where({id}).delete();
          if(!await tx.orm.public.NewsSlide.first())await tx.orm.public.NewsSettings.where({id:1}).update({enabled:false});
          await audit(tx,admin,"delete-news","სიახლე #"+id);
        } else {
          const title=text(body.title,"სათაური",false,100), description=text(body.description,"ტექსტი",true,350);
          if(typeof body.position!=="number"||!Number.isInteger(body.position)||body.position<0||body.position>99)throw new AdminError(400,"რიგითობა: 0–99");
          if(!id&&(await tx.orm.public.NewsSlide.all()).length>=12)throw new AdminError(409,"შეგიძლია მაქსიმუმ 12 სიახლის დამატება");
          const photoUrl=await normalizePhoto(body.photoUrl,1280,300000);
          if(!photoUrl.startsWith("data:image/jpeg;base64,"))throw new AdminError(400,"აირჩიე ფოტო კომპიუტერიდან");
          const values={title,description,photoUrl,position:body.position};
          if(id)await tx.orm.public.NewsSlide.where({id}).update(values);else await tx.orm.public.NewsSlide.create(values);
          await audit(tx,admin,"save-news",title);
        }
      } else throw new AdminError(400,"უცნობი მოქმედება");
    });
    return NextResponse.json({message:"ცვლილება შენახულია"});
  } catch(error){return failure(error);}
}
