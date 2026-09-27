"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import DoctorPhoto from "./doctor-photo";
import type {NewsItem} from "../news-slideshow";
import styles from "./admin.module.css";
type Item=NewsItem & {photoUrl:string};
export default function NewsManager(){
  const [data,setData]=useState<{enabled:boolean;slides:Item[]}|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[editing,setEditing]=useState<Item|null>(null),[deleting,setDeleting]=useState<Item|null>(null);
  const pending=useRef(false);
  const load=useCallback(async()=>{const r=await fetch("/api/admin/news",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error);setData(d);},[]);
  useEffect(()=>{const timer=setTimeout(()=>{void load().catch(e=>setError(e.message));},0);return()=>clearTimeout(timer);},[load]);
  async function mutate(body:Record<string,unknown>){
    if(pending.current)return false;pending.current=true;setBusy(true);setError("");setNotice("");
    try{const r=await fetch("/api/admin/news",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error);await load();setNotice(d.message);return true;}
    catch(e){setError(e instanceof Error?e.message:"შენახვა ვერ მოხერხდა");return false;}
    finally{pending.current=false;setBusy(false);}
  }
  return <><div className={styles.sectionHeading}><div><h1>მთავარი გვერდის სიახლეები</h1><p>ფოტო, სათაური და ტექსტი — ერთ სლაიდზე.</p></div><button className={styles.primary} disabled={busy||!data||data.slides.length>=12} onClick={()=>{setError("");setEditing({id:0,title:"",description:"",photoUrl:"",position:data?.slides.length||0});}}>+ სიახლის დამატება</button></div>
    {notice&&<p role="status" className={styles.notice}>{notice}</p>}{error&&!editing&&!deleting&&<p role="alert" className={styles.error}>{error}<button onClick={()=>void load().catch(e=>setError(e.message))}>ხელახლა ცდა</button></p>}
    {data&&<><section className={styles.panel}><div className={styles.sectionHeading}><div><h2>სლაიდშოუ {data.enabled?"ჩართულია":"გამორთულია"}</h2><p>გამორთვისას ფოტოები და ტექსტები ინახება, მთავარ გვერდზე კი არ გამოჩნდება.</p></div><button role="switch" aria-checked={data.enabled} aria-label="სლაიდშოუს ჩართვა" className={styles.primary} disabled={busy||(!data.enabled&&!data.slides.length)} onClick={()=>void mutate({action:"toggle",enabled:!data.enabled})}>{data.enabled?"სლაიდშოუს გამორთვა":"სლაიდშოუს ჩართვა"}</button></div></section>
    {!data.slides.length&&<div className={styles.empty}>ჯერ სიახლე არ დამატებულა. დაამატე ფოტო და ტექსტი, შემდეგ ჩართე სლაიდშოუ.</div>}
    <div className={styles.newsGrid}>{data.slides.map(slide=><article key={slide.id} className={styles.panel}><div className={styles.newsPreview}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={slide.photoUrl} alt=""/><div><small>სიახლე · {slide.position}</small><h3>{slide.title}</h3><p>{slide.description}</p></div></div><div className={styles.actions}><button disabled={busy} onClick={()=>{setError("");setEditing(slide);}}>რედაქტირება</button><button className={styles.danger} disabled={busy} onClick={()=>{setError("");setDeleting(slide);}}>წაშლა</button></div></article>)}</div></>}
    {editing&&<NewsEditor item={editing} busy={busy} error={error} close={()=>{if(!busy)setEditing(null);}} save={async values=>{if(await mutate({action:"save",...values,id:editing.id||undefined}))setEditing(null);}}/>}
    {deleting&&<NewsDialog title="სიახლის წაშლა" close={()=>{if(!busy)setDeleting(null);}}><div className={styles.modalBody}><p>ნამდვილად წავშალოთ „{deleting.title}“? ეს მოქმედება ვერ გაუქმდება.</p>{error&&<p role="alert" className={styles.error}>{error}</p>}<div className={styles.actions}><button disabled={busy} onClick={()=>setDeleting(null)}>გაუქმება</button><button disabled={busy} className={styles.danger} onClick={async()=>{if(await mutate({action:"delete",id:deleting.id}))setDeleting(null);}}>წაშლა</button></div></div></NewsDialog>}
  </>;
}
function NewsDialog({title,close,children}:{title:string;close:()=>void;children:React.ReactNode}){const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const el=ref.current;el?.showModal();return()=>el?.close();},[]);return <dialog ref={ref} className={styles.modal} onCancel={e=>{e.preventDefault();close();}} aria-labelledby="news-editor-title"><div className={styles.modalHead}><h2 id="news-editor-title">{title}</h2><button type="button" aria-label="დახურვა" onClick={close}>×</button></div>{children}</dialog>;}
function NewsEditor({item,busy,error,close,save}:{item:Item;busy:boolean;error:string;close:()=>void;save:(item:Item)=>Promise<void>}){
  const [draft,setDraft]=useState(item),[photoBusy,setPhotoBusy]=useState(false);
  return <NewsDialog title={item.id?"სიახლის რედაქტირება":"ახალი სიახლე"} close={()=>{if(!photoBusy)close();}}><form className={styles.modalBody} onSubmit={e=>{e.preventDefault();if(!busy&&!photoBusy)void save(draft);}}><label>სათაური<input required maxLength={100} value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))}/></label><label>ტექსტი ფოტოზე<textarea maxLength={350} rows={3} value={draft.description} onChange={e=>setDraft(d=>({...d,description:e.target.value}))}/></label><DoctorPhoto value={draft.photoUrl} onChange={photoUrl=>setDraft(d=>({...d,photoUrl}))} onBusy={setPhotoBusy} dimension={1280} maxBytes={300000} news/><label>რიგითობა<input type="number" min={0} max={99} required value={draft.position} onChange={e=>setDraft(d=>({...d,position:Number(e.target.value)}))}/></label><p className={styles.hint}>მცირე რიცხვი პირველია. სასურველია ჰორიზონტალური ფოტო; ტექსტი ქვედა ნაწილში გამოჩნდება. ჩართულ სლაიდშოუში შენახული ცვლილება გამოქვეყნდება.</p>{error&&<p role="alert" className={styles.error}>{error}</p>}<div className={styles.formActions}><button type="button" disabled={busy||photoBusy} onClick={close}>გაუქმება</button><button className={styles.primary} disabled={busy||photoBusy||!draft.photoUrl}>{busy?"ინახება…":"შენახვა"}</button></div></form></NewsDialog>;
}
