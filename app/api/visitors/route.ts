import {db} from '@/src/prisma/db';
import {sameOrigin,readBody,tokenHash,failure,AdminError} from '@/src/admin-auth';
export async function POST(request:Request){try{sameOrigin(request);const body=await readBody(request,256);if(typeof body.token!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(body.token))throw new AdminError(400,'მოთხოვნა არასწორია');const hash=tokenHash(body.token);await db.transaction(async tx=>{await tx.execute(db.raw.sql`INSERT INTO public."visitorSession" ("tokenHash") VALUES (${hash}) ON CONFLICT ("tokenHash") DO UPDATE SET "lastSeenAt"=now() WHERE "visitorSession"."lastSeenAt" < now()-interval '40 seconds' RETURNING id`.returnsRow({id:'pg/int4@1'}).build());});return new Response(null,{status:204})}catch(e){return failure(e)}}


