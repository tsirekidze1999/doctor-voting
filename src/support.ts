import { randomBytes } from "node:crypto";
import { db } from "./prisma/db";
import { AdminError, tokenHash, type Tx } from "./admin-auth";
export const SUPPORT_COOKIE="medfriend_support";
export function supportToken(request:Request){const value=request.headers.get("cookie")?.split(";").map(s=>s.trim()).find(s=>s.startsWith(SUPPORT_COOKIE+"="))?.slice(SUPPORT_COOKIE.length+1);return value&&/^[a-f0-9]{64}$/.test(value)?value:null;}
export const newSupportToken=()=>randomBytes(32).toString("hex");
export async function lockSupport(tx:Tx){await tx.execute(db.raw.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(9274202)`.returnsRow({locked:"pg/int4@1"}).build());}
export async function supportThread(tx:Tx,request:Request){const token=supportToken(request);return token?tx.orm.public.SupportThread.where({tokenHash:tokenHash(token)}).first():null;}
export function supportEmail(value:unknown){if(typeof value!=="string"||value.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw new AdminError(400,"შეიყვანე სწორი ელფოსტა");return value.trim().toLowerCase();}
export async function supportLimit(tx:Tx,key:string,limit:number,windowMs:number){const old=await tx.orm.public.SupportRate.where({key}).first();const recent=old&&Date.now()-Date.parse(old.windowStart)<windowMs;if(recent&&old.count>=limit)throw new AdminError(429,"შეტყობინებები ძალიან ხშირად იგზავნება. სცადე მოგვიანებით.");const values={count:recent?old.count+1:1,windowStart:recent?old.windowStart:new Date().toISOString()};if(old)await tx.orm.public.SupportRate.where({id:old.id}).update(values);else await tx.orm.public.SupportRate.create({key,...values});}
export function mailEnabled(){return Boolean(process.env.RESEND_API_KEY&&process.env.SUPPORT_EMAIL_FROM);}
export async function sendSupportEmail(messageId:number){
 if(!mailEnabled())throw new AdminError(503,"ელფოსტა ჯერ არ არის გამართული. გამოიყენე ელფოსტის გახსნის ღილაკი ან უპასუხე ჩათში.");
 return db.transaction(async tx=>{await lockSupport(tx);const message=await tx.orm.public.SupportMessage.where({id:messageId,sender:"admin"}).first();if(!message)throw new AdminError(404,"პასუხი ვერ მოიძებნა");if(message.emailSentAt)return;
 const thread=await tx.orm.public.SupportThread.where({id:message.threadId}).first();if(!thread?.emailConsent)throw new AdminError(400,"მომხმარებელმა ელფოსტით პასუხი არ მოითხოვა");
 const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+process.env.RESEND_API_KEY,"Content-Type":"application/json","Idempotency-Key":"medfriend-support-"+message.id},body:JSON.stringify({from:process.env.SUPPORT_EMAIL_FROM,to:[thread.email],subject:"MedFriend — პასუხი თქვენს კითხვაზე",text:"გამარჯობა, "+thread.name+"!\n\n"+message.body+"\n\nMedFriend-ის მხარდაჭერის გუნდი"}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw new AdminError(502,"ჩათში პასუხი შენახულია, მაგრამ ელფოსტით გაგზავნა ვერ მოხერხდა. სცადე ხელახლა.");await tx.orm.public.SupportMessage.where({id:message.id}).update({emailSentAt:new Date().toISOString()});
 });
}
