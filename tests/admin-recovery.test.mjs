import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

class AdminError extends Error { constructor(status,message){super(message);this.status=status;} }
function fixture(){
 const codes=[],users=[{id:1,username:'tornike',active:true,passwordHash:'old'}],sessions=[{id:1,userId:1,endedAt:null}],audits=[],sent=[];
 const model=(rows)=>{const query=(filters=[])=>({where(f){if(typeof f==='function')return query([...filters,r=>f(new Proxy({}, {get:(_,k)=>({isNull:()=>r[k]==null,like:v=>r[k]?.startsWith(v.replace('%',''))})}))]);return query([...filters,r=>Object.entries(f).every(([k,v])=>r[k]===v)])},orderBy(){return query(filters)},limit(){return query(filters)},async all(){return rows.filter(r=>filters.every(f=>f(r))).slice().reverse()},async first(){return rows.find(r=>filters.every(f=>f(r)))},async create(v){const row={id:rows.length+1,attempts:0,consumedAt:null,createdAt:new Date().toISOString(),...v};rows.push(row);return row},async update(v){for(const r of rows.filter(r=>filters.every(f=>f(r))))Object.assign(r,v)},async delete(){for(let i=rows.length-1;i>=0;i--)if(filters.every(f=>f(rows[i])))rows.splice(i,1)}});return query()};
 const tx={orm:{public:{VerificationCode:model(codes),AdminUser:model(users),AdminSession:model(sessions),AdminLoginAttempt:model([])}}};
 const require=(name)=>({
 'node:crypto':{randomInt:()=>123456},
 'next/server':{NextResponse:{json:(data,options)=>({data,status:options.status,cookies:{set(){}}})}},
 '@/src/prisma/db':{db:{transaction:fn=>fn(tx)}},
 '@/src/admin-auth':{AdminError,audit:async(...args)=>audits.push(args),COOKIE:'session',failure:e=>({status:e.status||503,data:{error:e.message}}),identity:u=>u,lockAdmin:async()=>{},readBody:r=>r.json(),sameOrigin:r=>{if(r.headers.get('origin')!=='https://example.com')throw new AdminError(403,'origin')}},
 '@/src/admin-password':{hashPassword:async p=>'hash:'+p,verifyPassword:async(p,h)=>h==='hash:'+p},
 '@/src/sms':{isUbillSmsEnabled:()=>true,sendSmsCode:async(...args)=>sent.push(args)},
 }[name]);
 const code=ts.transpileModule(fs.readFileSync('app/api/admin/recovery/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(code,{require,exports,process:{env:{NODE_ENV:'test'}},Date});
 const call=body=>exports.POST({headers:new Headers({origin:'https://example.com'}),json:async()=>body});
 return {codes,users,sessions,audits,sent,call,model,tx};
}
test('recovery SMS destination is fixed; arbitrary phone cannot override it',async()=>{const f=fixture();const r=await f.call({action:'send',username:'tornike',phone:'+995555111222'});assert.equal(r.status,200);assert.equal(f.sent[0][0],'+995592308338');assert.notEqual(f.codes[0].codeHash,'123456');assert.equal(f.codes[0].phone,undefined)});
test('incorrect attempts persist and fifth attempt blocks further codes',async()=>{const f=fixture();await f.call({action:'send',username:'tornike'});const body={action:'reset',username:'tornike',challengeId:1,code:'000000',newPassword:'a-long-password',confirmPassword:'a-long-password'};for(let i=0;i<5;i++)assert.equal((await f.call(body)).status,400);assert.equal(f.codes[0].attempts,5);assert.equal((await f.call({...body,code:'123456'})).status,400);assert.equal(f.users[0].passwordHash,'old')});
test('valid code is one-use and ends sessions',async()=>{const f=fixture();await f.call({action:'send',username:'tornike'});const body={action:'reset',username:'tornike',challengeId:1,code:'123456',newPassword:'a-long-password',confirmPassword:'a-long-password'};assert.equal((await f.call(body)).status,200);assert.equal(f.users[0].passwordHash,'hash:a-long-password');assert.ok(f.sessions[0].endedAt);assert.ok(f.codes[0].consumedAt);assert.equal(f.audits.length,1);assert.equal((await f.call(body)).status,400)});
test('expired or mismatched-account challenges do not change credentials',async()=>{const f=fixture();await f.call({action:'send',username:'tornike'});const body={action:'reset',username:'mariam',challengeId:1,code:'123456',newPassword:'a-long-password',confirmPassword:'a-long-password'};assert.equal((await f.call(body)).status,400);f.codes[0].expiresAt=new Date(Date.now()-1).toISOString();assert.equal((await f.call({...body,username:'tornike'})).status,400);assert.equal(f.users[0].passwordHash,'old')});
test('resends are limited and unknown accounts never trigger SMS',async()=>{const f=fixture();assert.equal((await f.call({action:'send',username:'unknown'})).status,200);assert.equal(f.sent.length,0);assert.equal((await f.call({action:'send',username:'tornike'})).status,429)});

function load(source,modules){const exports={};const code=ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{require:n=>modules[n],exports,Date,process:{env:{}}});return exports}
test('archived elections with votes are deleted in dependency order and audited',async()=>{
 const f=fixture(),elections=[{id:3,title:'Demo',isActive:false,winnerPublished:true}],votes=[{id:1,electionId:3}],candidates=[{id:1,electionId:3}],categories=[{id:1,electionId:3}],sponsors=[{id:1,electionId:3}],approvals=[{id:1,electionId:3,status:'pending'}];
 Object.assign(f.tx.orm.public,{Election:f.model(elections),Vote:f.model(votes),Candidate:f.model(candidates),Category:f.model(categories),Sponsor:f.model(sponsors),AdminApproval:f.model(approvals)});f.tx.execute=async()=>[];
 const sql=()=>({returnsRow(){return {build(){return {}}}}});
 const actions=load('src/admin-actions.ts',{'./doctor-photo':{normalizePhoto:async()=>''},'node:crypto':{},'./prisma/db':{db:{raw:{sql}}},'./admin-auth':{AdminError,audit:async()=>f.audits.push('delete')},'./admin-permissions':{ACTION_LABELS:{'delete-election':'Delete'}}});
 await actions.executeAction(f.tx,{id:1,name:'Owner'},{action:'delete-election',electionId:3});assert.equal(elections.length,0);assert.equal(votes.length,0);assert.equal(candidates.length,0);assert.equal(categories.length,0);assert.equal(sponsors.length,0);assert.equal(approvals[0].status,'rejected');assert.equal(f.audits.length,1);
});
test('manager cannot use owner password-reset endpoint',async()=>{
 const f=fixture();const route=load('app/api/admin/route.ts',{'next/server':{NextResponse:{json:data=>({status:200,data})}},'@/src/prisma/db':{db:{transaction:fn=>fn(f.tx)}},'@/src/admin-auth':{AdminError,authenticate:async()=>({admin:{role:'manager',username:'mariam'}}),lockAdmin:async()=>{},readBody:r=>r.json(),sameOrigin:()=>{},failure:e=>({status:e.status||503})},'@/src/admin-permissions':{},'@/src/admin-actions':{},'@/src/admin-password':{}});
 assert.equal((await route.POST({json:async()=>({action:'reset-admin-password',id:1,password:'a-long-password'})})).status,403);assert.equal(f.users[0].passwordHash,'old');
});
