"use client";
import Link from "next/link";
import Image from "next/image";
import NewsManager from "./news-manager";
import DoctorPhoto from "./doctor-photo";
import RecoveryForm from "./recovery-form";
import AdminResetForm from "./reset-form";
import PasswordForm from "./password-form";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ACTION_LABELS, ACTION_PERMISSION, PERMISSIONS, ALL_PERMISSIONS, allowed, type AdminIdentity, type Permission } from "@/src/admin-permissions";
import styles from "./admin.module.css";

type Doctor = { id: number; categoryId: number; firstName: string; lastName: string; specialty: string | null; description: string | null; photoUrl: string | null; votes?: number; testVotes?: number };
type Category = { id: number; name: string; candidates: Doctor[] };
type Election = { id: number; title: string; description: string | null; startsAt: string; endsAt: string; isActive: boolean; winnerPublished: boolean; categories: Category[]; totals: { candidates: number; votes: number | null } };
type Approval = { id: number; userId: number; actorName: string; electionId: number; action: string; payload: string; status: string; reviewerName: string | null; createdAt: string };
type History = { id: number; actorName: string; action: string; detail: string; createdAt: string };
type Session = { id: number; name: string; createdAt: string; lastSeenAt: string; endedAt: string | null; expiresAt: string };
type Voter = { id: number; electionId: number; categoryId: number | null; candidateId: number; phone: string | null; createdAt: string };
type Data = { admin: AdminIdentity; elections: Election[]; approvals: Approval[]; users: AdminIdentity[]; history: History[]; sessions: Session[]; voters: Voter[] };
type Form = { kind: "election" | "category" | "doctor" | "user"; election?: Election; category?: Category; doctor?: Doctor; user?: AdminIdentity };
const roleName = (role: string) => role === "superadmin" ? "მთავარი ადმინი" : role === "manager" ? "მენეჯერი" : "მოდერატორი";
const date = (value: string) => new Intl.DateTimeFormat("ka-GE", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tbilisi" }).format(new Date(value));
const localInput = (value?: string) => value ? new Date(Date.parse(value) - new Date(value).getTimezoneOffset() * 60_000).toISOString().slice(0,16) : "";
function status(e: Election, now: number) { return e.winnerPublished ? "გამოქვეყნებული" : Date.parse(e.endsAt) <= now ? "დასრულებული" : !e.isActive ? "შეჩერებული" : Date.parse(e.startsAt) > now ? "დაგეგმილი" : "მიმდინარე"; }
function Icon({ name }: { name: string }) {
  const paths: Record<string,string> = { home: "M3 10 12 3l9 7v11h-6v-7H9v7H3Z", elections: "M5 4h14v17H5ZM8 9h8M8 13h8M8 17h5", team: "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-3a4 4 0 0 0-3-3.87M16 2a4 4 0 0 1 0 8", approvals: "m7 12 3 3 7-7M21 12a9 9 0 1 1-9-9", history: "M3 12a9 9 0 1 0 3-7M3 3v5h5M12 7v5l3 2", logout: "M9 3H3v18h6M8 12h13m-4-4 4 4-4 4" };
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.elections}/></svg>;
}
function Modal({title, children, close}: {title: string; children: ReactNode; close:()=>void}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(()=>{ const el=ref.current; el?.showModal(); return ()=>el?.close(); },[]);
  return <dialog ref={ref} className={styles.modal} onCancel={event=>{event.preventDefault();close();}} aria-labelledby="modal-title"><div className={styles.modalHead}><h2 id="modal-title">{title}</h2><button type="button" aria-label="დახურვა" onClick={close}>×</button></div>{children}</dialog>;
}
export default function AdminPage() {
  const [data,setData]=useState<Data|null>(null), [ready,setReady]=useState(false), [error,setError]=useState(""), [notice,setNotice]=useState("");
  const [username,setUsername]=useState(""), [password,setPassword]=useState(""), [busy,setBusy]=useState(false);
  const [tab,setTab]=useState("home"), [selected,setSelected]=useState<number|null>(null), [form,setForm]=useState<Form|null>(null);
  const [confirm,setConfirm]=useState<{ title:string; body:Record<string,unknown> }|null>(null);
  const [passwordOpen,setPasswordOpen]=useState(false);
  const [recoveryOpen,setRecoveryOpen]=useState(false);
  const [resetUser,setResetUser]=useState<AdminIdentity|null>(null);
  const [search,setSearch]=useState("");
  const [voterSearch,setVoterSearch]=useState("");
  const [now,setNow]=useState(0);
  const filteredVoters=data?.voters.filter(v=>{const q=voterSearch.trim().toLowerCase();if(!q)return true;const e=data.elections.find(x=>x.id===v.electionId);const d=e?.categories.flatMap(c=>c.candidates).find(x=>x.id===v.candidateId);return [v.phone,e?.title,d?.firstName,d?.lastName].filter(Boolean).join(" ").toLowerCase().includes(q)})||[];
  const loggedIn=Boolean(data);
  const busyRef=useRef(false);
  const sessionGeneration=useRef(0);
  const fetchData=useCallback(async()=>{
    const generation=sessionGeneration.current;
    const r=await fetch("/api/admin",{cache:"no-store"});
    const d=await r.json();
    if(generation!==sessionGeneration.current)return;
    if(r.status===401){setData(null); return;}
    if(!r.ok)throw new Error(d.error);
    setData(d);setNow(Date.now());setError("");
  },[]);
  useEffect(()=>{let active=true;const timer=setTimeout(()=>{void fetchData().catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setReady(true)});},0);return()=>{active=false;clearTimeout(timer)}},[fetchData]);
  useEffect(()=>{if(!loggedIn)return;const timer=setInterval(()=>{if(!document.hidden&&!busyRef.current)void fetchData().catch(e=>setError(e.message));},20_000);return()=>clearInterval(timer)},[loggedIn,fetchData]);
  async function login(event:React.FormEvent) {
    event.preventDefault(); if(busyRef.current)return; busyRef.current=true;setBusy(true);setError("");
    try{const r=await fetch("/api/admin/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})});const d=await r.json();if(!r.ok)throw new Error(d.error);setPassword("");await fetchData();}
    catch(e){setError(e instanceof Error?e.message:"შესვლა ვერ მოხერხდა");}
    finally{busyRef.current=false;setBusy(false);}
  }
  async function mutate(body:Record<string,unknown>) {
    if(busyRef.current)return false;busyRef.current=true;setBusy(true);setError("");setNotice("");
    try{const r=await fetch("/api/admin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const d=await r.json();if(!r.ok){if(r.status===401)setData(null);throw new Error(d.error)}setNotice(d.message);await fetchData();return true;}
    catch(e){setError(e instanceof Error?e.message:"მოქმედება ვერ შესრულდა");return false;}
    finally{busyRef.current=false;setBusy(false);}
  }
  async function logout(){
    if(busyRef.current)return;busyRef.current=true;sessionGeneration.current++;setBusy(true);
    try{const r=await fetch("/api/admin/session",{method:"DELETE"});if(!r.ok&&r.status!==401)throw new Error("გასვლა ვერ მოხერხდა");setData(null);setForm(null);setConfirm(null);setNotice("");setPassword("");setError("");}
    catch(e){setError((e as Error).message)}finally{busyRef.current=false;setBusy(false)}
  }
  function exportCsv(){
    if(!data)return;
    const rows=[["არჩევნები","კატეგორია","ექიმი","ოფიციალური ხმები"]];
    for(const e of data.elections)for(const c of e.categories)for(const d of c.candidates)rows.push([e.title,c.name,d.firstName+" "+d.lastName,String(d.votes??0)]);
    const escape=(value:string)=>'"'+(/^[=+@\-\t\r]/.test(value)?"'":"")+value.replaceAll('"','""')+'"';
    const csv="\uFEFF"+rows.map(row=>row.map(escape).join(",")).join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="election-results.csv";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  if(!ready)return <div className={styles.loginPage}><p role="status">პანელი იტვირთება…</p></div>;
  if(!data)return <div className={styles.loginPage}><div className={styles.loginArt}><div className={styles.brand}><Image src="/medfriend-logo.png" alt="MedFriend" width={190} height={60} className={styles.brandLogo}/><small>მართვის სივრცე</small></div><h1>კარგი გუნდი.<br/>გამჭვირვალე არჩევანი.</h1><p>არჩევნები, ადამიანები და შედეგები — ერთ სივრცეში.</p><div className={styles.orbit}/></div><form onSubmit={login} className={styles.loginForm}><span className={styles.eyebrow}>კეთილი დაბრუნება</span><h2>შედი შენს სივრცეში</h2><p>გამოიყენე შენი პირადი ანგარიში.</p><label>მომხმარებელი<input autoComplete="username" required value={username} onChange={e=>setUsername(e.target.value)} placeholder="მაგალითად: tornike"/></label><label>პაროლი<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{notice&&<p role="status">{notice}</p>}{error&&<p className={styles.error} role="alert">{error}</p>}<button className={styles.primary} disabled={busy}>{busy?"მოწმდება…":"შესვლა →"}</button><button type="button" onClick={()=>setRecoveryOpen(true)}>დამავიწყდა პაროლი</button><Link href="/">← მთავარ საიტზე დაბრუნება</Link></form>{recoveryOpen&&<Modal title="პაროლის აღდგენა" close={()=>setRecoveryOpen(false)}><RecoveryForm done={message=>{setRecoveryOpen(false);setNotice(message);setError("");setPassword("");}}/></Modal>}</div>;
  const me=data.admin;
  const can=(p:Permission)=>allowed(me,p);
  const pending=data.approvals.filter(a=>a.status==="pending");
  const election=data.elections.find(e=>e.id===selected)||data.elections[0];
  const totalVotes=data.elections.reduce((sum,e)=>sum+(e.totals.votes||0),0);
  const nav=[["home","მიმოხილვა"],["elections","არჩევნები"],["approvals","დასამტკიცებელი"],...(can("manageNews")?[["news","სიახლეები"]]:[]),...(can("manageAdmins")?[["team","გუნდი და უფლებები"]]:[]),...(can("viewAudit")?[["history","აქტივობის ისტორია"]]:[])];
  const act=(action:string, e:Election, extra:Record<string,unknown>={})=>setConfirm({title:(can(ACTION_PERMISSION[action])?"":"მოთხოვნა: ")+ACTION_LABELS[action],body:{action,electionId:e.id,...extra}});
  const actionText=(action:string,label:string)=>can(ACTION_PERMISSION[action])?label:label+" · მოთხოვნა";
  const editUser=(user:AdminIdentity)=>user.id!==me.id&&user.role!=="superadmin"&&(me.role==="superadmin"||user.role!=="manager")&&user.permissions.every(p=>can(p));
  return <div className={styles.shell}><aside className={styles.sidebar}><div className={styles.brand}><Image src="/medfriend-logo.png" alt="MedFriend" width={190} height={60} className={styles.brandLogo}/></div><p className={styles.navCaption}>სამუშაო სივრცე</p><nav>{nav.map(([key,label])=><button key={key} className={tab===key?styles.navActive:""} onClick={()=>{setTab(key);setSearch("")}}><Icon name={key}/>{label}{key==="approvals"&&pending.length>0&&<b>{pending.length}</b>}</button>)}</nav><div className={styles.sidebarBottom}><p>ყოველი მოქმედება მნიშვნელოვანია.</p><a href="/" target="_blank" rel="noreferrer">საიტის ნახვა ↗</a></div></aside>
  <div className={styles.workspace}><header className={styles.topbar}><span>სამუშაო სივრცე / <b>{nav.find(n=>n[0]===tab)?.[1]}</b></span><div className={styles.account}><span className={styles.avatar}>{me.name.slice(0,1)}</span><div><b>{me.name}</b><small>{roleName(me.role)}</small></div><button onClick={()=>setPasswordOpen(true)}>პაროლის შეცვლა</button><button aria-label="გასვლა" title="გასვლა" onClick={()=>void logout()} disabled={busy}><Icon name="logout"/></button></div></header>
  <main className={styles.content}>{notice&&<div className={styles.notice} role="status">{notice}<button onClick={()=>setNotice("")} aria-label="შეტყობინების დახურვა">×</button></div>}{error&&<div className={styles.error} role="alert">{error}</div>}
  {tab==="news"&&can("manageNews")&&<NewsManager/>}
  {tab==="home"&&<><section className={styles.hero}><div><span className={styles.eyebrow}>შენი გუნდის სივრცე</span><h1>გამარჯობა, {me.name}! <span>☀</span></h1><p className={styles.dayWish}>წარმატებულ დღეს გისურვებ!</p><p className={styles.positiveNote}>შენი ყურადღება და ზრუნვა ამ დღეს უკეთესს ხდის.</p><button onClick={()=>setTab("elections")}>არჩევნების მართვა ↗</button></div><div className={styles.heroArt}><span>✚</span><small>ერთად უკეთესი<br/>შედეგებისთვის</small></div></section>
  <div className={styles.stats}>{[["არჩევნები",data.elections.length,"ყველა შექმნილი არჩევნები"],["მიმდინარე",data.elections.filter(e=>status(e,now)==="მიმდინარე").length,"ხმის მიცემა გახსნილია"],["დასამტკიცებელი",pending.length,"ელოდება გადაწყვეტილებას"],["მიღებული ხმები",can("viewResults")?totalVotes:"—","ოფიციალური ხმები"]].map(([label,value,sub])=><div className={styles.stat} key={label}><small>{label}</small><strong>{value}</strong><span>{sub}</span></div>)}</div>
  <div className={styles.sectionHeading}><div><h2>არჩევნების მიმოხილვა</h2><p>ბოლო არჩევნები და მათი მიმდინარე მდგომარეობა</p></div><button onClick={()=>setForm({kind:"election"})} className={styles.primary}>+ ახალი არჩევნები</button></div>
  {data.elections.length===0?<div className={styles.empty}>ჯერ არჩევნები არ შექმნილა. დაიწყე პირველი არჩევნებით.</div>:data.elections.slice(0,4).map(e=><button key={e.id} className={styles.electionRow} onClick={()=>{setSelected(e.id);setTab("elections")}}><div className={styles.rowIcon}><Icon name="elections"/></div><div><h3>{e.title}</h3><p>{e.totals.candidates} ექიმი · {e.categories.length} კატეგორია</p></div><span className={styles.badge}>{status(e,now)}</span><span>↗</span></button>)}</>}
  {tab==="elections"&&<><div className={styles.sectionHeading}><div><h1>არჩევნები</h1><p>შექმენი, დაგეგმე და მართე თითოეული ეტაპი.</p></div><div className={styles.actions}>{can("viewResults")&&<button onClick={exportCsv}>CSV ჩამოტვირთვა ↓</button>}<button className={styles.primary} onClick={()=>setForm({kind:"election"})}>+ ახალი არჩევნები</button></div></div><div className={styles.electionTabs}>{data.elections.map(e=><button key={e.id} className={election?.id===e.id?styles.selected:""} onClick={()=>setSelected(e.id)}>{e.title}<small>{status(e,now)}</small></button>)}</div>
  {election?<><section className={styles.panel}><div className={styles.sectionHeading}><div><span className={styles.badge}>{status(election,now)}</span><h2>{election.title}</h2><p>{election.description}</p></div><button onClick={()=>setForm({kind:"election",election})}>რედაქტირება</button></div><div className={styles.schedule}><div><small>დაწყება · თბილისის დრო</small><b>{date(election.startsAt)}</b></div><span>→</span><div><small>დასრულება · თბილისის დრო</small><b>{date(election.endsAt)}</b></div></div><div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={()=>act(election.isActive?"stop":"start",election)}>{actionText(election.isActive?"stop":"start",election.isActive?"შეჩერება":"ჩართვა / დაგეგმვა")}</button><button disabled={busy} onClick={()=>act(election.winnerPublished?"unpublish":"publish",election)}>{actionText("publish",election.winnerPublished?"შედეგების დამალვა":"შედეგების დადასტურება")}</button><button className={styles.danger} disabled={busy} onClick={()=>act("delete-election",election)}>წაშლა</button></div><p className={styles.hint}>თარიღების შენახვის შემდეგ ჩართე არჩევნები — მითითებულ დროს ხმის მიცემა ავტომატურად დაიწყება და დასრულდება. გამოქვეყნება ცალკე დასტურს საჭიროებს.</p></section>
  <div className={styles.sectionHeading}><div><h2>კატეგორიები და ექიმები</h2><p>რედაქტირებული მონაცემები ხელახალ გამოქვეყნებას საჭიროებს.</p></div><div className={styles.actions}><button onClick={()=>setForm({kind:"category",election})}>+ კატეგორია</button><button className={styles.primary} disabled={!election.categories.length} onClick={()=>setForm({kind:"doctor",election})}>+ ექიმი</button></div></div><input className={styles.search} aria-label="ექიმის ძებნა" placeholder="მოძებნე ექიმი…" value={search} onChange={e=>setSearch(e.target.value)}/>
  {election.categories.length===0&&<div className={styles.empty}>ჯერ დაამატე კატეგორია, შემდეგ — ექიმები.</div>}
  {election.categories.map(c=><section className={styles.panel} key={c.id}><div className={styles.sectionHeading}><h3>{c.name} <span className={styles.count}>{c.candidates.length}</span></h3><div className={styles.actions}><button onClick={()=>setForm({kind:"category",election,category:c})}>რედაქტირება</button><button className={styles.danger} onClick={()=>act("delete-category",election,{categoryId:c.id})}>წაშლა</button></div></div>{c.candidates.filter(d=>(d.firstName+" "+d.lastName).includes(search.trim())).sort((a,b)=>(b.votes||0)-(a.votes||0)).map((d,i)=><div className={styles.doctorRow} key={d.id}><span className={styles.rank}>{String(i+1).padStart(2,"0")}</span><div className={styles.doctorName}><b>{d.firstName} {d.lastName}</b><small>{d.specialty||"სპეციალობა არ არის მითითებული"}</small></div>{can("viewResults")&&<div className={styles.voteCount}><b>{d.votes||0}</b><small>ხმა{d.testVotes? " · "+d.testVotes+" სატესტო (ცალკე)":""}</small></div>}<button onClick={()=>setForm({kind:"doctor",election,doctor:d})}>რედაქტირება</button><button className={styles.danger} onClick={()=>act("delete-candidate",election,{candidateId:d.id})}>წაშლა</button></div>)}</section>)}</>:<div className={styles.empty}>დაამატე შენი პირველი არჩევნები.</div>}</>}
  {tab==="team"&&can("manageAdmins")&&<><div className={styles.sectionHeading}><div><h1>გუნდი და უფლებები</h1><p>სწორი წვდომა — გუნდის თითოეული წევრისთვის.</p></div><button className={styles.primary} onClick={()=>setForm({kind:"user"})}>+ ახალი ადმინი</button></div><div className={styles.teamGrid}>{data.users.map(u=><section className={styles.userCard} key={u.id}><div className={styles.userHead}><span className={styles.avatar}>{u.name.slice(0,1)}</span><span className={styles.badge}>{u.active?"აქტიური":"გამორთული"}</span></div><h2>{u.name}</h2><p>@{u.username} · {roleName(u.role)}</p><div className={styles.permissionTags}>{u.permissions.map(p=><span key={p}>{PERMISSIONS[p]}</span>)}</div><button disabled={!editUser(u)} onClick={()=>setForm({kind:"user",user:u})}>{u.role==="superadmin"?"დაცული მთავარი ანგარიში":u.id===me.id?"შენი ანგარიში":"უფლებების მართვა"}</button>{me.role==="superadmin"&&me.username==="tornike"&&u.id!==me.id&&<button onClick={()=>setResetUser(u)}>პაროლის განახლება</button>}</section>)}</div></>}
  {tab==="approvals"&&<><div className={styles.sectionHeading}><div><h1>დასამტკიცებელი მოთხოვნები</h1><p>ერთი უფლებამოსილი ადმინის დასტური საკმარისია.</p></div><span className={styles.badge}>{pending.length} მოლოდინში</span></div>{data.approvals.length===0?<div className={styles.empty}><Icon name="approvals"/><h2>ყველაფერი მოწესრიგებულია</h2><p>დასამტკიცებელი მოთხოვნები აქ გამოჩნდება.</p></div>:data.approvals.map(a=><section className={styles.panel} key={a.id}><div className={styles.sectionHeading}><div><span className={styles.badge}>{a.status==="pending"?"მოლოდინში":a.status==="approved"?"დადასტურებული":"უარყოფილი"}</span><h3>{ACTION_LABELS[a.action]}</h3><p>{a.actorName} · {date(a.createdAt)} · #{a.id}</p></div>{a.status==="pending"&&a.userId!==me.id&&can(ACTION_PERMISSION[a.action])&&<div className={styles.actions}><button className={styles.primary} onClick={()=>setConfirm({title:"მოთხოვნის დადასტურება",body:{action:"approve",id:a.id}})}>დადასტურება</button><button onClick={()=>setConfirm({title:"მოთხოვნის უარყოფა",body:{action:"reject",id:a.id}})}>უარყოფა</button></div>}</div><p>{data.elections.find(e=>e.id===a.electionId)?.title||"ახალი არჩევნები"}</p><dl className={styles.requestDetails}>{Object.entries(JSON.parse(a.payload) as Record<string,unknown>).filter(([key])=>key!=="action").map(([key,value])=><div key={key}><dt>{{title:"სათაური",description:"აღწერა",electionId:"არჩევნების ID",categoryId:"კატეგორიის ID",candidateId:"ექიმის ID",name:"სახელი",firstName:"სახელი",lastName:"გვარი",specialty:"სპეციალობა",photoUrl:"ფოტო",startsAt:"დაწყება",endsAt:"დასრულება"}[key]||key}</dt><dd>{key==="photoUrl"&&String(value).startsWith("data:")?"ატვირთული ფოტო":String(value||"—")}</dd></div>)}</dl>{a.reviewerName&&<p>გადაწყვეტილება: {a.reviewerName}</p>}</section>)}</>}
  {tab==="history"&&can("viewAudit")&&<><div className={styles.sectionHeading}><div><h1>აქტივობის ისტორია</h1><p>თბილისის დრო · ბოლო 100 სესია და 150 მოქმედება</p></div><button onClick={()=>void fetchData().catch(e=>setError(e.message))}>განახლება ↻</button></div><section className={styles.panel}><h2>შესვლის ისტორია</h2><p className={styles.hint}>„ბოლო აქტივობა“ განახლდება პანელის გამოყენებისას. ბრაუზერის დახურვა ავტომატურად არ ნიშნავს „გასვლას“; სესია 12 საათში სრულდება.</p><div className={styles.tableWrap}><table><thead><tr><th>ადმინი</th><th>შესვლა</th><th>ბოლო აქტივობა</th><th>გასვლა / სტატუსი</th></tr></thead><tbody>{data.sessions.map(s=><tr key={s.id}><td>{s.name}</td><td>{date(s.createdAt)}</td><td>{date(s.lastSeenAt)}</td><td>{s.endedAt?date(s.endedAt):Date.parse(s.expiresAt)<now?"ვადაგასული":"სესია ღიაა"}</td></tr>)}</tbody></table></div></section><section className={styles.panel}><h2>მოქმედებების ჟურნალი</h2>{data.history.map(h=><div key={h.id} className={styles.historyRow}><span className={styles.historyDot}/><div><b>{h.actorName} · {ACTION_LABELS[h.action]||h.action}</b><p>{h.detail}</p></div><time>{date(h.createdAt)}</time></div>)}</section></>}
  {tab==="history"&&can("viewVoterDetails")&&<section className={styles.panel}><div className={styles.sectionHeading}><div><h2>ხმის გადამოწმება</h2><p className={styles.hint}>ეს მონაცემი ჩანს მხოლოდ თორნიკეს, მარიამის და თაკოს ანგარიშებზე.</p></div><button onClick={()=>{const rows=[["ნომერი","არჩევნები","ექიმი","დრო"],...filteredVoters.map(v=>{const e=data.elections.find(x=>x.id===v.electionId);const d=e?.categories.flatMap(c=>c.candidates).find(x=>x.id===v.candidateId);return [v.phone||"",e?.title||"",d?d.firstName+" "+d.lastName:"",date(v.createdAt)]})];const url=URL.createObjectURL(new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"}));const a=document.createElement("a");a.href=url;a.download="voter-check.csv";a.click();URL.revokeObjectURL(url)}}>CSV ჩამოტვირთვა</button></div><input className={styles.searchInput} value={voterSearch} onChange={e=>setVoterSearch(e.target.value)} placeholder="მოძებნე ნომრით, არჩევნებით ან ექიმით..." /><div className={styles.tableWrap}><table><thead><tr><th>ნომერი</th><th>არჩევნები</th><th>ექიმი</th><th>დრო</th></tr></thead><tbody>{filteredVoters.map(v=>{const election=data.elections.find(e=>e.id===v.electionId);const doctor=election?.categories.flatMap(c=>c.candidates).find(d=>d.id===v.candidateId);return <tr key={v.id}><td>{v.phone||"—"}</td><td>{election?.title||("#"+v.electionId)}</td><td>{doctor?doctor.firstName+" "+doctor.lastName:("#"+v.candidateId)}</td><td>{date(v.createdAt)}</td></tr>})}</tbody></table></div></section>}
  <footer className={styles.footer}>MedFriend · მართვის სივრცე <span>მონაცემები ახლდება ყოველ 20 წამში</span></footer></main></div>
  {resetUser&&<Modal title={resetUser.name+" · პაროლის განახლება"} close={()=>{if(!busy)setResetUser(null)}}><AdminResetForm userId={resetUser.id} busy={busy} error={error} save={mutate} done={()=>setResetUser(null)}/></Modal>}
  {passwordOpen&&<Modal title="პაროლის შეცვლა" close={()=>setPasswordOpen(false)}><PasswordForm done={()=>{sessionGeneration.current++;setData(null);setPasswordOpen(false);setPassword("");setNotice("პაროლი შეიცვალა. შედი ახალი პაროლით.");setError("");}}/></Modal>}
  {form&&<Editor form={form} me={me} busy={busy} error={error} save={mutate} close={()=>{if(!busy){setForm(null);setError("")}}}/>}
  {confirm&&<Modal title={confirm.title} close={()=>{if(!busy)setConfirm(null)}}><div className={styles.modalBody}><p>{confirm.body.action==="delete-election"?"ეს წაშლის არჩევნებს, ყველა ექიმს, კატეგორიას და ხმას, მათ შორის არქივის შედეგებს. აღდგენა შეუძლებელია. ნამდვილად გსურს წაშლა?":"ნამდვილად გსურს ამ მოქმედების შესრულება?"}</p><p className={styles.hint}>თუ პირდაპირი უფლება არ გაქვს, მოქმედება გაიგზავნება დასამტკიცებლად. შესრულება ჩაიწერება ისტორიაში.</p>{error&&<p role="alert" className={styles.error}>{error}</p>}<div className={styles.actions}><button disabled={busy} onClick={()=>setConfirm(null)}>გაუქმება</button><button disabled={busy} className={styles.primary} onClick={async()=>{if(await mutate(confirm.body))setConfirm(null)}}>{busy?"მუშავდება…":"დადასტურება"}</button></div></div></Modal>}
  </div>;
}

function Editor({form,me,busy,error,save,close}:{form:Form;me:AdminIdentity;busy:boolean;error:string;save:(body:Record<string,unknown>)=>Promise<boolean>;close:()=>void}) {
  const e=form.election,d=form.doctor,u=form.user;
  const [values,setValues]=useState<Record<string,string>>({title:e?.title||"",description:(form.kind==="doctor"?d?.description:e?.description)||"",startsAt:localInput(e?.startsAt),endsAt:localInput(e?.endsAt),name:form.category?.name||u?.name||"",firstName:d?.firstName||"",lastName:d?.lastName||"",specialty:d?.specialty||"",photoUrl:d?.photoUrl||"",categoryId:String(d?.categoryId||e?.categories[0]?.id||""),username:u?.username||"",password:""});
  const [permissions,setPermissions]=useState<Permission[]>(u?.permissions||["manageDoctors","viewResults"]);
  const [photoBusy,setPhotoBusy]=useState(false);
  const [active,setActive]=useState(u?.active??true);
  const [localError,setLocalError]=useState("");
  function field(key:string,label:string,type="text",required=false) {return <label>{label}<input type={type} required={required} maxLength={key==="description"?2000:undefined} value={values[key]} onChange={event=>setValues(v=>({...v,[key]:event.target.value}))} autoComplete={type==="password"?"new-password":"off"}/></label>}
  async function submit(event:React.FormEvent){
    event.preventDefault();if(photoBusy)return;setLocalError("");
    let body:Record<string,unknown>={...values};
    if(form.kind==="user")body={action:"save-user",id:u?.id,username:values.username,name:values.name,password:values.password,permissions,active};
    if(form.kind==="election"){
      const start=Date.parse(values.startsAt),end=Date.parse(values.endsAt);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start){setLocalError("მიუთითე სწორი დაწყებისა და დასრულების დრო");return;}
      body={...values,action:e?"edit-election":"create",electionId:e?.id,startsAt:new Date(start).toISOString(),endsAt:new Date(end).toISOString()};
    }
    if(form.kind==="category")body={action:form.category?"update-category":"add-category",electionId:e?.id,categoryId:form.category?.id,name:values.name};
    if(form.kind==="doctor")body={...values,action:d?"update-candidate":"add-candidate",electionId:e?.id,candidateId:d?.id,categoryId:Number(values.categoryId)};
    if(await save(body))close();
  }
  const title=form.kind==="user"?(u?"უფლებების მართვა":"ახალი ადმინი"):form.kind==="election"?(e?"არჩევნების რედაქტირება":"ახალი არჩევნები"):form.kind==="category"?(form.category?"კატეგორიის რედაქტირება":"ახალი კატეგორია"):(d?"ექიმის რედაქტირება":"ახალი ექიმი");
  return <Modal title={title} close={close}><form className={styles.modalBody} onSubmit={submit}>
  {form.kind==="election"&&<>{field("title","არჩევნების სათაური","text",true)}{field("description","აღწერა")}<div className={styles.formGrid}>{field("startsAt","დაწყება","datetime-local",true)}{field("endsAt","დასრულება","datetime-local",true)}</div><p className={styles.hint}>დრო ივსება შენი მოწყობილობის დროის სარტყლით. ახალი არჩევნები შეიქმნება შეჩერებულად, რათა ჯერ ექიმები დაამატო.</p></>}
  {form.kind==="category"&&field("name","კატეგორიის სახელი","text",true)}
  {form.kind==="doctor"&&<><div className={styles.formGrid}>{field("firstName","სახელი","text",true)}{field("lastName","გვარი","text",true)}</div><label>კატეგორია<select value={values.categoryId} onChange={event=>setValues(v=>({...v,categoryId:event.target.value}))}>{e?.categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>{field("specialty","სპეციალობა")}{field("description","აღწერა")}<DoctorPhoto value={values.photoUrl} onChange={photoUrl=>setValues(v=>({...v,photoUrl}))} onBusy={setPhotoBusy}/><p className={styles.hint}>ხმების მიღების შემდეგ ექიმის კატეგორია დაცულია შეცვლისგან.</p></>}
  {form.kind==="user"&&<>{field("name","სახელი","text",true)}<div className={styles.formGrid}>{field("username","მომხმარებელი (ლათინურად)","text",true)}{field("password",u?"ახალი პაროლი — სურვილისამებრ":"პაროლი (მინ. 12 სიმბოლო)","password",!u)}</div><label className={styles.check}><input type="checkbox" checked={active} onChange={event=>setActive(event.target.checked)}/>ანგარიში აქტიურია</label><h3>მიანიჭე საჭირო უფლებები</h3><p className={styles.hint}>მოუნიშნავი მოქმედება საჭიროებს უფლებამოსილი ადმინის დასტურს. ანგარიშების მართვა და ისტორია ხელმისაწვდომია მხოლოდ შესაბამისი უფლებით.</p><div className={styles.permissionList}>{ALL_PERMISSIONS.map(p=><label key={p} className={styles.check}><input type="checkbox" checked={permissions.includes(p)} disabled={!allowed(me,p)} onChange={event=>setPermissions(v=>event.target.checked?[...v,p]:v.filter(x=>x!==p))}/><span>{PERMISSIONS[p]}</span></label>)}</div></>}
  {(error||localError)&&<p role="alert" className={styles.error}>{localError||error}</p>}<div className={styles.formActions}><button type="button" onClick={close} disabled={busy}>გაუქმება</button><button className={styles.primary} disabled={busy||photoBusy}>{photoBusy?"ფოტო მუშავდება…":busy?"ინახება…":"შენახვა"}</button></div></form></Modal>;
}
