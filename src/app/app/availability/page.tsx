"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Plus, RefreshCw } from "lucide-react";
import { addAvailabilityException, listAvailabilityExceptions, listAvailabilityRules, upsertAvailabilityRule } from "@/lib/api/people";
import { getSessionContext } from "@/lib/api/session";
import { addCalendarDays, calendarDateInZone, startOfCalendarWeek } from "@/lib/shiftii/calendar";

type Rule = { id:string; dayOfWeek:number; startMinute:number; endMinute:number; isAvailable:boolean };
type Exception = { id:string; date:string; isAvailable:boolean; reason:string|null };
const weekdays=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const panel="rounded-2xl border border-[#111110]/10 bg-[#F6F4EF]";
const field="w-full rounded-md border border-[#111110]/20 bg-white/75 px-3 py-3 text-sm outline-none focus:border-[#111110]";
const button="inline-flex items-center justify-center gap-2 rounded-md bg-[#111110] px-5 py-3 text-sm font-medium text-white hover:bg-black disabled:opacity-40";
function fmt(minutes:number){return `${Math.floor(minutes/60).toString().padStart(2,"0")}:${(minutes%60).toString().padStart(2,"0")}`;}
function mins(s:string){const [h,m]=s.split(":").map(Number);return h*60+m;}
function pretty(day:string){return new Date(day+"T12:00:00Z").toLocaleDateString("en-CA",{weekday:"short",month:"short",day:"numeric",timeZone:"UTC"});}
export default function AvailabilityPage(){
  const [week,setWeek]=useState("");
  const [zone,setZone]=useState("");
  const [rules,setRules]=useState<Rule[]>([]);
  const [exceptions,setExceptions]=useState<Exception[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [day,setDay]=useState(1);
  const [from,setFrom]=useState("09:00");
  const [to,setTo]=useState("17:00");
  const [available,setAvailable]=useState(true);
  const [exceptionDate,setExceptionDate]=useState("");
  const [exceptionAvailable,setExceptionAvailable]=useState(false);
  const [reason,setReason]=useState("");
  async function refresh(start:string){
    const [a,b]=await Promise.all([
      listAvailabilityRules({}),
      listAvailabilityExceptions({from:start,to:addCalendarDays(start,6)}),
    ]);
    if(!a.ok)throw new Error(a.error);
    if(!b.ok)throw new Error(b.error);
    setRules(a.data);setExceptions(b.data);
  }
  useEffect(()=>{
    let active=true;
    void (async()=>{
      try{
        const ctx=await getSessionContext();
        if(!ctx.ok)throw new Error(ctx.error);
        if(!active)return;
        const tz=ctx.data.organization.timezone;
        const first=startOfCalendarWeek(calendarDateInZone(new Date(),tz),ctx.data.organization.weekStartDay);
        setZone(tz);setWeek(first);setExceptionDate(first);
        await refresh(first);
      }catch(e){if(active)setError(e instanceof Error?e.message:"Could not load availability.");}
      finally{if(active)setLoading(false);}
    })();
    return()=>{active=false;};
  },[]);
  async function run(task:()=>Promise<void>,message:string){
    setBusy(true);setError("");setNotice("");
    try{await task();await refresh(week);setNotice(message);}
    catch(e){setError(e instanceof Error?e.message:"Unable to save availability.");}
    finally{setBusy(false);}
  }
  async function nextWeek(delta:number){
    if(!week)return;
    const next=addCalendarDays(week,delta*7);
    setBusy(true);setError("");
    try{await refresh(next);setWeek(next);setExceptionDate(next);}
    catch(e){setError(e instanceof Error?e.message:"Could not load the selected week.");}
    finally{setBusy(false);}
  }
  async function addRule(e:React.FormEvent){
    e.preventDefault();
    await run(async()=>{
      const r=await upsertAvailabilityRule({dayOfWeek:day,startMinute:mins(from),endMinute:mins(to),isAvailable:available});
      if(!r.ok)throw new Error(r.error);
    },"Recurring availability recorded.");
  }
  async function addException(e:React.FormEvent){
    e.preventDefault();
    await run(async()=>{
      const r=await addAvailabilityException({date:exceptionDate,isAvailable:exceptionAvailable,reason:reason.trim()||undefined});
      if(!r.ok)throw new Error(r.error);
      setReason("");
    },"Date exception recorded.");
  }
  return <main className="min-h-screen bg-[#CCDBD6] text-[#111110]">
    <header className="border-b border-black/10"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10"><Link href="/app/roster" className="inline-flex items-center gap-2 text-sm"><ArrowLeft size={16}/> Roster</Link><Link href="/" className="font-serif text-[28px]">Shifti</Link><Link href="/app" className="text-sm underline underline-offset-4">Workspace</Link></div></header>
    <div className="mx-auto max-w-7xl px-6 pb-24 pt-12 lg:px-10 lg:pt-16">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#111110]/60">Your working hours</p>
      <h1 className="font-serif mt-4 text-5xl font-normal tracking-tight sm:text-6xl">Availability.</h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#111110]/70">Tell your team when you can work. Update your regular hours and mark specific days you need off.</p>
      {error&&<p role="alert" className="mt-7 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice&&<p role="status" className="mt-7 flex items-center gap-2 rounded-md border border-black/10 bg-white/70 p-4 text-sm"><Check size={17}/>{notice}</p>}
      {loading?<p className="mt-12 text-sm text-[#111110]/70"><RefreshCw size={16} className="mr-2 inline animate-spin"/>Loading availability...</p>:<>
      <section className={panel+" mt-10 p-5 sm:p-7"}>
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-serif text-2xl">Your week</h2><p className="mt-1 text-sm text-[#111110]/60">{zone}</p></div><div className="flex items-center gap-2"><button className="rounded-md border border-black/20 p-3 disabled:opacity-30" disabled={busy} aria-label="Previous week" onClick={()=>void nextWeek(-1)}><ChevronLeft size={18}/></button><button className="rounded-md border border-black/20 p-3 disabled:opacity-30" disabled={busy} aria-label="Next week" onClick={()=>void nextWeek(1)}><ChevronRight size={18}/></button></div></div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">{Array.from({length:7},(_,i)=>addCalendarDays(week,i)).map(date=>{
          const weekday=new Date(date+"T12:00:00Z").getUTCDay();
          const todayExceptions=exceptions.filter(x=>x.date===date);
          const regular=rules.filter(r=>r.dayOfWeek===weekday);
          const unavailable=todayExceptions.some(x=>!x.isAvailable)||(!todayExceptions.length&&regular.some(r=>!r.isAvailable));
          return <div key={date} className="min-h-36 rounded-md border border-black/10 bg-white/70 px-3 py-4">
            <p className="text-xs font-semibold">{pretty(date)}</p>
            <p className={"mt-4 text-xs font-medium "+(unavailable?"text-[#9C553F]":"text-[#314C42]")}>{unavailable?"Unavailable":todayExceptions.some(x=>x.isAvailable)?"Available (exception)":regular.some(r=>r.isAvailable)?"Available":"No restriction set"}</p>
            <p className="mt-2 text-xs leading-5 text-[#111110]/55">{todayExceptions.length?todayExceptions.map(x=>x.reason||"Date exception").join(", "):regular.filter(r=>r.isAvailable).map(r=>fmt(r.startMinute)+" - "+fmt(r.endMinute)).join(", ")||"No weekly hours saved"}</p>
          </div>;
        })}</div>
      </section>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <form onSubmit={e=>void addRule(e)} className={panel+" p-6 sm:p-7"}>
          <div className="flex items-center gap-2"><Clock size={19}/><h2 className="font-serif text-2xl">Regular hours</h2></div>
          <p className="mt-2 text-sm text-[#111110]/60">Set recurring weekly availability. Each submission adds a time window.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm sm:col-span-2">Day of week<select className={field+" mt-2"} value={day} onChange={e=>setDay(Number(e.target.value))}>{weekdays.map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label><label className="text-sm">From<input className={field+" mt-2"} type="time" required value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="text-sm">To<input className={field+" mt-2"} type="time" required value={to} onChange={e=>setTo(e.target.value)}/></label></div>
          <label className="mt-5 flex items-center gap-3 text-sm"><input type="checkbox" checked={available} onChange={e=>setAvailable(e.target.checked)}/> I am available during these hours</label>
          <button disabled={busy} className={button+" mt-6 w-full"} type="submit"><Plus size={17}/> Save regular hours</button>
        </form>
        <form onSubmit={e=>void addException(e)} className={panel+" p-6 sm:p-7"}>
          <div className="flex items-center gap-2"><CalendarDays size={19}/><h2 className="font-serif text-2xl">Specific date</h2></div>
          <p className="mt-2 text-sm text-[#111110]/60">Mark a day as unavailable or make an exception to your regular hours.</p>
          <label className="mt-6 block text-sm">Date<input className={field+" mt-2"} type="date" required value={exceptionDate} onChange={e=>setExceptionDate(e.target.value)}/></label>
          <label className="mt-5 block text-sm">Status<select value={exceptionAvailable?"yes":"no"} onChange={e=>setExceptionAvailable(e.target.value==="yes")} className={field+" mt-2"}><option value="no">Unavailable</option><option value="yes">Available</option></select></label>
          <label className="mt-5 block text-sm">Note (optional)<input className={field+" mt-2"} maxLength={220} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Personal appointment"/></label>
          <button disabled={busy} className={button+" mt-6 w-full"} type="submit"><Plus size={17}/> Save date exception</button>
        </form>
      </div>
      </>}
    </div>
  </main>;
}
