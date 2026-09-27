import sharp from "sharp";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { db } from "../src/prisma/db.ts";
const base = "http://localhost:3000";
const tag = "qa_" + Date.now();
const password = randomBytes(18).toString("hex");
let userId, electionId, checks = 0;
const cookies = [];
async function call(cookie, body, status = 200, path = "/api/admin", origin = base) {
  const r = await fetch(base + path, {method:body ? "POST" : "GET", headers:{"Content-Type":"application/json",Origin:origin,...(cookie ? {Cookie:cookie}: {})}, ...(body ? {body:JSON.stringify(body)} : {})});
  const data = await r.json();
  assert.equal(r.status,status,JSON.stringify(data)); checks++;
  return data;
}
async function login(username,password) {
  const r=await fetch(base+"/api/admin/session",{method:"POST",headers:{"Content-Type":"application/json",Origin:base},body:JSON.stringify({username,password})});
  assert.equal(r.status,200); checks++;
  const cookie=r.headers.get("set-cookie").split(";")[0];cookies.push(cookie);return cookie;
}
try {
  const configured=JSON.parse(process.env.ADMIN_USERS);
  const ownerConfig=configured.find(u=>u.username==="tornike");
  const managerConfig=configured.find(u=>u.username==="mariam");
  const owner=await login(ownerConfig.username,ownerConfig.password);
  const manager=await login(managerConfig.username,managerConfig.password);
  await call(null,null,401);
  await call(owner,{action:"stop",electionId:1},403,"/api/admin","https://invalid.example");
  const initial=await call(owner);const ownerId=initial.admin.id;
  const user={username:tag,name:tag,active:true,permissions:["manageDoctors","viewResults"],password};
  await call(manager,{action:"save-user",...user});
  userId=(await call(owner)).users.find(u=>u.username===tag).id;
  const mod=await login(tag,password);
  const restricted=await call(mod);
  assert.deepEqual(restricted.users,[]);assert.deepEqual(restricted.history,[]);assert.deepEqual(restricted.sessions,[]);checks+=3;
  assert.ok(!JSON.stringify(restricted).includes("passwordHash"));checks++;
  await call(mod,{action:"save-user",...user},403);
  await call(manager,{action:"save-user",id:ownerId,...user},403);
  const dates={startsAt:new Date(Date.now()-60000).toISOString(),endsAt:new Date(Date.now()+3600000).toISOString()};
  await call(owner,{action:"create",title:tag,description:"Temporary admin regression fixture",...dates});
  electionId=(await call(owner)).elections.find(e=>e.title===tag).id;
  await call(owner,{action:"add-category",electionId,name:tag});
  const categoryId=(await call(owner)).elections.find(e=>e.id===electionId).categories[0].id;
  await call(mod,{action:"add-candidate",electionId,categoryId,firstName:"QA",lastName:tag});
  const candidateId=(await call(owner)).elections.find(e=>e.id===electionId).categories[0].candidates[0].id;
  const photoBytes=await sharp({create:{width:64,height:80,channels:3,background:"#008080"}}).jpeg().toBuffer();
  const photoUrl="data:image/jpeg;base64,"+photoBytes.toString("base64");
  const editPhoto={action:"update-candidate",electionId,categoryId,candidateId,firstName:"QA",lastName:tag,photoUrl};
  await call(mod,editPhoto);
  const savedPhoto=(await call(owner)).elections.find(e=>e.id===electionId).categories[0].candidates[0].photoUrl;
  assert.equal((await sharp(Buffer.from(savedPhoto.split(",")[1],"base64")).metadata()).width,64);checks++;
  await call(null,editPhoto,401);
  await call(mod,{...editPhoto,photoUrl:"data:image/svg+xml;base64,PHN2Zz4="},400);
  await call(mod,{...editPhoto,photoUrl:"data:image/jpeg;base64,bm90YW5pbWFnZQ=="},400);
  await call(mod,{...editPhoto,photoUrl:"data:image/jpeg;base64,"+"A".repeat(110001)},400);
  await call(mod,{...editPhoto,photoUrl:""});
  assert.equal((await call(owner)).elections.find(e=>e.id===electionId).categories[0].candidates[0].photoUrl,null);checks++;
  await db.orm.public.Vote.create({electionId,categoryId,candidateId,phone:"TEST:"+tag});
  const requested=await call(mod,{action:"start",electionId});assert.equal(requested.pending,true);checks++;
  let snapshot=await call(owner);
  assert.equal(snapshot.elections.find(e=>e.id===electionId).isActive,false);checks++;
  let requestId=snapshot.approvals.find(a=>a.userId===userId&&a.status==="pending").id;
  await call(mod,{action:"approve",id:requestId},403);
  await call(manager,{action:"approve",id:requestId});
  await call(manager,{action:"approve",id:requestId},409);
  assert.equal((await call(owner)).elections.find(e=>e.id===electionId).isActive,true);checks++;
  await call(manager,{action:"publish",electionId},409);
  await call(manager,{action:"stop",electionId});
  await call(mod,{action:"publish",electionId});
  requestId=(await call(owner)).approvals.find(a=>a.userId===userId&&a.status==="pending").id;
  await call(manager,{action:"approve",id:requestId});
  assert.equal((await call(owner)).elections.find(e=>e.id===electionId).winnerPublished,true);checks++;
  const published=await call(null,null,200,"/api/election");
  assert.equal(published.election.id,electionId);assert.equal(published.candidates[0].votes,0);checks+=2;
  await call(manager,{action:"unpublish",electionId});
  await call(manager,{action:"save-user",id:userId,...user,password:"",permissions:[...user.permissions,"controlElections"]});
  assert.equal((await call(mod,{action:"start",electionId})).pending,undefined);checks++;
  await call(manager,{action:"stop",electionId});
  await call(manager,{action:"save-user",id:userId,...user,password:""});
  assert.equal((await call(mod,{action:"start",electionId})).pending,true);checks++;
  requestId=(await call(owner)).approvals.find(a=>a.userId===userId&&a.status==="pending").id;
  await call(manager,{action:"edit-election",electionId,title:tag,description:"Changed",...dates});
  await call(manager,{action:"approve",id:requestId},409);
  await call(manager,{action:"reject",id:requestId});
  await call(manager,{action:"save-user",id:userId,...user,password:"",active:false});
  await call(mod,null,401);
  const end=await call(manager);
  assert.ok(end.history.some(h=>h.action==="login"&&h.actorName===tag));checks++;
  console.log("PASS: "+checks+" admin authentication, permissions, approval, revocation and audit checks.");
} finally {
  for(const cookie of cookies) await fetch(base+"/api/admin/session",{method:"DELETE",headers:{Origin:base,Cookie:cookie}}).catch(()=>{});
  await db.transaction(async tx=>{
    if(electionId){
      for(const v of await tx.orm.public.Vote.where({electionId}).all()) await tx.orm.public.Vote.where({id:v.id}).delete();
      for(const a of await tx.orm.public.AdminApproval.where({electionId}).all()) await tx.orm.public.AdminApproval.where({id:a.id}).delete();
      for(const c of await tx.orm.public.Candidate.where({electionId}).all()) await tx.orm.public.Candidate.where({id:c.id}).delete();
      for(const c of await tx.orm.public.Category.where({electionId}).all()) await tx.orm.public.Category.where({id:c.id}).delete();
      await tx.orm.public.Election.where({id:electionId}).delete();
    }
    if(userId){
      for(const s of await tx.orm.public.AdminSession.where({userId}).all()) await tx.orm.public.AdminSession.where({id:s.id}).delete();
      for(const a of await tx.orm.public.AdminAudit.where({userId}).all()) await tx.orm.public.AdminAudit.where({id:a.id}).delete();
      await tx.orm.public.AdminUser.where({id:userId}).delete();
    }
  });
  await db.close();
}
