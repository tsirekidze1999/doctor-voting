import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { db } from '../src/prisma/db.ts';
import { hashPassword } from '../src/admin-password.ts';
const base='http://localhost:3000';
if(!['localhost','127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error('Local test database only');
const username='pwqa_'+Date.now(), old=randomBytes(20).toString('hex'), next=randomBytes(20).toString('hex');
let id;let checks=0;
async function request(path,body,cookie,expected=200,origin=base){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();assert.equal(r.status,expected,JSON.stringify(d));checks++;return {r,d};}
async function login(p,expected=200){const {r}=await request('/api/admin/session',{username,password:p},null,expected);return r.headers.get('set-cookie')?.split(';')[0];}
const payload={currentPassword:old,newPassword:next,confirmPassword:next};
try{
 await db.orm.public.AdminUser.create({username,name:'Password QA',passwordHash:await hashPassword(old),role:'moderator',permissions:'[]',active:true});
 id=(await db.orm.public.AdminUser.where({username}).first()).id;
 const a=await login(old),b=await login(old);
 await request('/api/admin/password',payload,null,401);
 await request('/api/admin/password',payload,a,403,'https://evil.example');
 await request('/api/admin/password',{...payload,newPassword:'short',confirmPassword:'short'},a,400);
 await request('/api/admin/password',{...payload,confirmPassword:'different'},a,400);
 await request('/api/admin/password',{...payload,newPassword:old,confirmPassword:old},a,400);
 for(let i=0;i<8;i++)await request('/api/admin/password',{...payload,currentPassword:'wrong-password'},a,400);
 await request('/api/admin/password',payload,a,429);
 const attempt=await db.orm.public.AdminLoginAttempt.where({username}).first();assert.equal(attempt.failures,8);checks++;
 await db.orm.public.AdminLoginAttempt.where({id:attempt.id}).update({windowStart:new Date(Date.now()-901000).toISOString()});
 const result=await request('/api/admin/password',payload,a);
 assert.match(result.r.headers.get('set-cookie'),/Max-Age=0/i);checks++;
 await request('/api/admin',null,a,401);await request('/api/admin',null,b,401);
 await login(old,401);const c=await login(next);await request('/api/admin',null,c);
 const audit=await db.orm.public.AdminAudit.where({userId:id}).all();assert.ok(audit.some(x=>x.action==='change-password'));assert.ok(!JSON.stringify(audit).includes(next));checks+=2;
 console.log(`PASS ${checks} password validation, CSRF, rate limit, session revocation and login checks`);
}finally{
 if(id){for(const x of await db.orm.public.AdminSession.where({userId:id}).all())await db.orm.public.AdminSession.where({id:x.id}).delete();for(const x of await db.orm.public.AdminAudit.where({userId:id}).all())await db.orm.public.AdminAudit.where({id:x.id}).delete();await db.orm.public.AdminUser.where({id}).delete();}
 for(const x of await db.orm.public.AdminLoginAttempt.where({username}).all())await db.orm.public.AdminLoginAttempt.where({id:x.id}).delete();await db.close();
}
