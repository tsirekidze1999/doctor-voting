import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
export const dynamic="force-dynamic";
export async function GET(){
  try {
    const slides=await db.transaction(async tx=>{
      if(!(await tx.orm.public.NewsSettings.where({id:1}).first())?.enabled)return [];
      return tx.orm.public.NewsSlide.select("id","title","description","position").orderBy(s=>s.position.asc()).orderBy(s=>s.id.asc()).all();
    });
    return NextResponse.json({slides},{headers:{"Cache-Control":"no-store"}});
  }catch{return NextResponse.json({slides:[]},{status:503,headers:{"Cache-Control":"no-store"}});}
}
