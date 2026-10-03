"use client";
import {useEffect,useState} from "react";
export type NewsItem={id:number;title:string;description:string;position:number;photoUrl?:string};
export default function NewsSlideshow(){
  const [slides,setSlides]=useState<NewsItem[]>([]),[index,setIndex]=useState(0),[paused,setPaused]=useState(false),[hover,setHover]=useState(false),[focused,setFocused]=useState(false),[reduced,setReduced]=useState(true);
  useEffect(()=>{
    const controller=new AbortController();
    const load=()=>{if(document.hidden)return;void fetch("/api/news",{cache:"no-store",signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(d=>setSlides(d.slides)).catch(()=>{});};
    load();const timer=setInterval(load,30000);document.addEventListener("visibilitychange",load);
    const media=matchMedia("(prefers-reduced-motion: reduce)");const change=()=>setReduced(media.matches);change();media.addEventListener("change",change);
    return()=>{controller.abort();clearInterval(timer);document.removeEventListener("visibilitychange",load);media.removeEventListener("change",change);};
  },[]);
  const current=index%Math.max(slides.length,1);
  useEffect(()=>{
    if(slides.length<2||paused||hover||focused||reduced)return;
    const timer=setInterval(()=>{if(!document.hidden)setIndex(i=>(i+1)%slides.length);},6500);
    return()=>clearInterval(timer);
  },[slides.length,paused,hover,focused,reduced]);
  if(!slides.length)return null;
  const slide=slides[current];
  return <section className="news-carousel" aria-label="MedFriend-ის სიახლეები" aria-roledescription="სლაიდშოუ" onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setFocused(false);}}>
    <div className="news-slide" key={slide.id} role="group" aria-roledescription="სლაიდი" aria-label={`${current+1} / ${slides.length}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="news-photo" src={slide.photoUrl||`/api/news/${slide.id}/photo`} alt=""/>
      <div className="news-shade"/><div className="news-copy"><span>MEDFRIEND · სიახლეები</span><h2>{slide.title}</h2><p>{slide.description}</p></div>
    </div>
    {slides.length>1&&<div className="news-controls"><button aria-label="წინა სიახლე" onClick={()=>{setPaused(true);setIndex((current+slides.length-1)%slides.length);}}>←</button><div className="news-dots">{slides.map((s,i)=><button key={s.id} aria-label={`სიახლე ${i+1}: ${s.title}`} aria-current={i===current?"true":undefined} onClick={()=>{setPaused(true);setIndex(i);}}/>)}</div><button aria-label="შემდეგი სიახლე" onClick={()=>{setPaused(true);setIndex((current+1)%slides.length);}}>→</button>{!reduced&&<button className="news-pause" onClick={()=>setPaused(p=>!p)}>{paused?"გაგრძელება":"პაუზა"}</button>}</div>}
  </section>;
}
