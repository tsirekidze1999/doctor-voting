"use client";
import { useState } from "react";
import styles from "./admin.module.css";

export default function DoctorPhoto({value,onChange,onBusy}:{value:string;onChange:(value:string)=>void;onBusy:(busy:boolean)=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  async function choose(file?:File) {
    if(!file)return;
    setError("");
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>10*1024*1024){setError("აირჩიე JPG, PNG ან WebP ფოტო, მაქსიმუმ 10 MB.");return;}
    setBusy(true);onBusy(true);
    let bitmap:ImageBitmap|undefined;
    try {
      bitmap=await createImageBitmap(file);
      const scale=Math.min(1,480/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const ctx=canvas.getContext("2d");if(!ctx)throw new Error();
      ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      let photo=canvas.toDataURL("image/jpeg",0.8);
      for(const quality of [0.65,0.5,0.35]){if(photo.length<=106000)break;photo=canvas.toDataURL("image/jpeg",quality);}
      if(photo.length>106000)throw new Error();
      onChange(photo);
    } catch {setError("ფოტო ვერ გაიხსნა. სცადე სხვა JPG ან PNG სურათი.");}
    finally{bitmap?.close();setBusy(false);onBusy(false);}
  }
  return <div><label>ფოტოს არჩევა კომპიუტერიდან<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{void choose(e.target.files?.[0]);e.target.value="";}}/></label><p className={styles.hint}>JPG, PNG ან WebP · მაქსიმუმ 10 MB. ფოტო შეინახება ექიმის შენახვისას.</p>{busy&&<p role="status">ფოტო მუშავდება…</p>}{value&&<div style={{display:"flex",gap:16,alignItems:"center",margin:"12px 0"}}><img src={value} alt="ექიმის ფოტოს წინასწარი ნახვა" width={112} height={112} style={{objectFit:"cover",borderRadius:16}}/><button type="button" disabled={busy} onClick={()=>onChange("")}>ფოტოს მოცილება</button></div>}<label>ან ფოტოს https ბმული<input type="url" disabled={busy} value={value.startsWith("data:")?"":value} placeholder="https://…" onChange={e=>onChange(e.target.value)}/></label>{error&&<p role="alert" className={styles.error}>{error}</p>}</div>;
}
