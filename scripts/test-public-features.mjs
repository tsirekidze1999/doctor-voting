import assert from 'node:assert/strict';
import {db} from '../src/prisma/db.ts';
if(!['localhost','127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname))throw new Error('Local database only');
const ids=[];let checks=0;const base='http://localhost:3000';
async function get(query,status=200){const r=await fetch(base+'/api/election'+query);const d=await r.json();assert.equal(r.status,status);checks++;return d;}
try{
 for(const [i,published,active] of [[1,true,false],[2,true,false],[3,false,true],[4,false,false]]){
 const e=await db.orm.public.Election.create({title:`საცდელი დემო ${i} · არქივი და ბარათები`,description:'გამოგონილი მონაცემები, მხოლოდ ლოკალური დემონსტრაციისთვის.',startsAt:new Date(Date.now()-86400000).toISOString(),endsAt:new Date(Date.now()+(active?86400000:-1000)).toISOString(),isActive:active,winnerPublished:published});ids.push(e.id);
 const c=await db.orm.public.Category.create({electionId:e.id,name:'საცდელი კარდიოლოგია'});
 for(const [n,name] of [[1,'ნინო'],[2,'გიორგი']]){
 const d=await db.orm.public.Candidate.create({electionId:e.id,categoryId:c.id,firstName:name,lastName:'დემო კანდიდატი',specialty:'კარდიოლოგი',description:'ეს არის გამოგონილი ექიმის პროფილი. აქ რეალური ექიმის პროფესიული გამოცდილება და ინფორმაცია განთავსდება.'});
 if(published)await db.orm.public.Vote.create({electionId:e.id,categoryId:c.id,candidateId:d.id,phone:`DEMO:${e.id}:${n}`});
 if(published)await db.orm.public.Vote.create({electionId:e.id,categoryId:c.id,candidateId:d.id,phone:`TEST:${e.id}:${n}`});
 }
 }
 const vote=await get('?mode=vote');assert.equal(vote.election.id,ids[2]);assert.ok(vote.candidates.every(d=>!('votes'in d)));checks+=2;
 const latest=await get('?mode=winners');assert.equal(latest.election.id,ids[1]);assert.ok(latest.archive.some(e=>e.id===ids[0]));assert.ok(!latest.archive.some(e=>e.id===ids[2]||e.id===ids[3]));assert.ok(latest.candidates.every(d=>d.votes===1));checks+=4;
 const previous=await get(`?mode=winners&election=${ids[0]}`);assert.equal(previous.election.id,ids[0]);checks++;
 await get(`?mode=winners&election=${ids[2]}`,404);await get(`?mode=winners&election=${ids[3]}`,404);await get(`?mode=vote&election=${ids[0]}`,404);await get('?mode=winners&election=NaN',400);await get('?mode=unknown',400);
 assert.ok(!JSON.stringify(latest).includes('DEMO:'));checks++;
 await db.orm.public.Election.where({id:ids[1]}).update({winnerPublished:false});await get(`?mode=winners&election=${ids[1]}`,404);await db.orm.public.Election.where({id:ids[1]}).update({winnerPublished:true});
 console.log(`PASS ${checks} archive, selection, unpublished-data and vote privacy checks`);
 if(process.argv.includes('--keep-demo'))console.log('Local demo elections retained:',ids.slice(0,3));
}finally{
 const cleanup=process.argv.includes('--keep-demo')?ids.slice(3):ids;
 for(const electionId of cleanup){for(const v of await db.orm.public.Vote.where({electionId}).all())await db.orm.public.Vote.where({id:v.id}).delete();for(const c of await db.orm.public.Candidate.where({electionId}).all())await db.orm.public.Candidate.where({id:c.id}).delete();for(const c of await db.orm.public.Category.where({electionId}).all())await db.orm.public.Category.where({id:c.id}).delete();await db.orm.public.Election.where({id:electionId}).delete();}
 await db.close();
}
