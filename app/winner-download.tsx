"use client";
import { useEffect, useState } from "react";
export default function WinnerDownload({name,category,election,date,votes}:{name:string;category:string;election:string;date:string;votes:number}) {
 const [preview,setPreview]=useState("");
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 async function download(){
  setBusy(true);setError("");
  try{
   await document.fonts.ready;
   const canvas=document.createElement("canvas");canvas.width=1200;canvas.height=1200;
   const context=canvas.getContext("2d");if(!context)throw new Error();const c=context;
   c.fillStyle="#101115";c.fillRect(0,0,1200,1200);
   const gold=c.createLinearGradient(0,0,1200,1200);gold.addColorStop(0,"#f3dc9e");gold.addColorStop(.5,"#bd9146");gold.addColorStop(1,"#ead29c");
   c.strokeStyle=gold;c.lineWidth=3;c.strokeRect(35,35,1130,1130);c.lineWidth=1;c.strokeRect(48,48,1104,1104);
   c.textAlign="center";
   function text(value:string,y:number,size:number,color:string|CanvasGradient,maxLines=3){
    const linesFor=(fontSize:number)=>{c.font=`${fontSize}px Arial, sans-serif`;const lines:string[]=[];let line="";for(const char of value){if(c.measureText(line+char).width>1000){lines.push(line);line=char;}else line+=char;}if(line)lines.push(line);return lines;};
    let lines=linesFor(size);while(lines.length>maxLines&&size>12){size-=2;lines=linesFor(size);}
    c.fillStyle=color;lines.forEach((line,i)=>c.fillText(line.trim(),600,y+i*size*1.4));
   }
   text("MedFriend",145,66,gold);text("HEALTHCARE AWARD",199,25,"#d8c69f");
   c.beginPath();for(let i=0;i<16;i++){const angle=i*Math.PI/8-Math.PI/2,r=i%2?22:65;const x=600+Math.cos(angle)*r,y=330+Math.sin(angle)*r;if(i===0)c.moveTo(x,y);else c.lineTo(x,y);}c.closePath();c.fillStyle=gold;c.fill();
   text("გამარჯვებული",460,34,"#d9bd7e");text(name,550,54,"#fff4db",3);
   text(category,790,32,gold,2);text(`${votes} ხმა`,900,27,"#e4d3ad");
   text(election,995,23,"#c5bdaf",3);
   text(new Intl.DateTimeFormat("ka-GE",{dateStyle:"medium",timeZone:"Asia/Tbilisi"}).format(new Date(date)),1115,20,"#c5bdaf");
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error()),"image/png"));
   setPreview(URL.createObjectURL(blob));
  }catch{setError("ბარათი ვერ ჩამოიტვირთა. სცადე ხელახლა.");}finally{setBusy(false);}
 }
 return <div><button type="button" className="winner-download" onClick={()=>void download()} disabled={busy}>{busy?"მზადდება…":"ბარათის ჩამოტვირთვა ↓"}</button>{error&&<p role="alert">{error}</p>}{preview&&<div className="winner-preview"><img src={preview} alt={`${name} — გასაზიარებელი ბარათის ნიმუში`}/><a href={preview} download="MedFriend-Healthcare-Award.png">PNG ფაილის შენახვა ↓</a><button type="button" onClick={()=>setPreview("")}>დახურვა</button></div>}</div>;
}
