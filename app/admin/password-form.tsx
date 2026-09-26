"use client";
import { useState } from "react";
import styles from "./admin.module.css";
export default function PasswordForm({done}:{done:()=>void}) {
  const [currentPassword,setCurrent]=useState("");
  const [newPassword,setNew]=useState("");
  const [confirmPassword,setConfirm]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  async function submit(event:React.FormEvent){
    event.preventDefault();if(busy)return;setError("");
    if(newPassword!==confirmPassword){setError("ახალი პაროლები არ ემთხვევა.");return;}
    setBusy(true);
    try{const r=await fetch("/api/admin/password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({currentPassword,newPassword,confirmPassword})});const d=await r.json();if(!r.ok)throw new Error(d.error);setCurrent("");setNew("");setConfirm("");done();}
    catch(e){setError(e instanceof Error?e.message:"პაროლი ვერ შეიცვალა. სცადე ხელახლა.");}
    finally{setBusy(false);}
  }
  return <form onSubmit={submit} className={styles.passwordForm}><p>შეცვლის შემდეგ ყველა მოწყობილობაზე სესია დასრულდება. ხელახლა შედი ახალი პაროლით.</p><label>მიმდინარე პაროლი<input type="password" autoComplete="current-password" required maxLength={256} disabled={busy} value={currentPassword} onChange={e=>setCurrent(e.target.value)}/></label><label>ახალი პაროლი<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={busy} value={newPassword} onChange={e=>setNew(e.target.value)}/></label><small>გამოიყენე 12–128 სიმბოლო; სასურველია რამდენიმე სიტყვის კომბინაცია.</small><label>გაიმეორე ახალი პაროლი<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={busy} value={confirmPassword} onChange={e=>setConfirm(e.target.value)}/></label>{error&&<p role="alert" className={styles.error}>{error}</p>}<button className={styles.primary} disabled={busy}>{busy?"ინახება…":"პაროლის შეცვლა"}</button></form>;
}
