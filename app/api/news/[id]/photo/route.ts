import { db } from "@/src/prisma/db";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  if(!/^[1-9]\d{0,8}$/.test(id))return new Response(null,{status:404});
  try{
    const slide=await db.transaction(async tx=>{
      if(!(await tx.orm.public.NewsSettings.where({id:1}).first())?.enabled)return null;
      return tx.orm.public.NewsSlide.where({id:Number(id)}).first();
    });
    if(!slide)return new Response(null,{status:404,headers:{"Cache-Control":"no-store"}});
    return new Response(new Uint8Array(Buffer.from(slide.photoUrl.split(",")[1],"base64")),{headers:{"Content-Type":"image/jpeg","X-Content-Type-Options":"nosniff","Cache-Control":"no-store"}});
  }catch{return new Response(null,{status:503});}
}
