"use client";
import { useState } from "react";
import styles from "./admin.module.css";
export default function AdminResetForm({userId,busy,error,save,done}:{userId:number;busy:boolean;error:string;save:(body:Record<string,unknown>)=>Promise<boolean>;done:()=>void}){
 const [password,setPassword]=useState(""),[confirm,setConfirm]=useState("");
 return <form className={styles.passwordForm} onSubmit={async e=>{e.preventDefault();if(await save({action:"reset-admin-password",id:userId,password,confirmPassword:confirm}))done()}}><p>ადმინის ყველა ძველი სესია დასრულდება. უფლებები და მონაცემები შენარჩუნდება.</p><label>ახალი პაროლი<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={busy} value={password} onChange={e=>setPassword(e.target.value)}/></label><label>გაიმეორე ახალი პაროლი<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={busy} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>{error&&<p role="alert" className={styles.error}>{error}</p>}<button disabled={busy} className={styles.primary}>{busy?"ინახება…":"პაროლის განახლება"}</button></form>
}
