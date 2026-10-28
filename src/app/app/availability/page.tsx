"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { addAvailabilityException, listAvailabilityExceptions, listAvailabilityRules, upsertAvailabilityRule } from "@/lib/api/people";
import { getSessionContext } from "@/lib/api/session";
import { addCalendarDays, calendarDateInZone, startOfCalendarWeek } from "@/lib/shiftii/calendar";

type Rule = { id: string; dayOfWeek: number; startMinute: number; endMinute: number; isAvailable: boolean };
type Exception = { id: string; date: string; isAvailable: boolean; startMinute: number | null; endMinute: number | null; reason: string | null };
const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function dateLabel(value: string) { return new Date(value+"T12:00:00Z").toLocaleDateString("en-CA",{weekday:"short",month:"short",day:"numeric",timeZone:"UTC"}); }
function clock(minutes: number) { return String(Math.floor(minutes/60)).padStart(2,"0")+":"+String(minutes%60).padStart(2,"0"); }

export default function AvailabilityPage() {
  const [rules,setRules] = useState<Rule[]>([]);
  const [exceptions,setExceptions] = useState<Exception[]>([]);
  const [week,setWeek] = useState("");
  const [day,setDay] = useState("");
  const [available,setAvailable] = useState(false);
  const [reason,setReason] = useState("");
  const [weekday,setWeekday] = useState(1);
  const [from,setFrom] = useState("09:00");
  const [to,setTo] = useState("17:00");
  const [weeklyAvailable,setWeeklyAvailable] = useState(true);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const dates = useMemo(()=>week?Array.from({length:7},(_,i)=>addCalendarDays(week,i)):[],[week]);
  async function load(start: string) {
    const [r,e] = await Promise.all([listAvailabilityRules({}),listAvailabilityExceptions({from:start,to:addCalendarDays(start,6)})]);
    if (!r.ok) throw new Error(r.error);
    if (!e.ok) throw new Error(e.error);
    setRules(r.data);setExceptions(e.data);
  }
  useEffect(()=>{
    let active=true;
    void (async()=>{
      try {
        const ctx=await getSessionContext();if(!ctx.ok)throw new Error(ctx.error);
        const today=calendarDateInZone(new Date(),ctx.data.organization.timezone);
        const start=startOfCalendarWeek(today,ctx.data.organization.weekStartDay);
        if(!active)return;setWeek(start);setDay(today);
        const [r,e]=await Promise.all([listAvailabilityRules({}),listAvailabilityExceptions({from:start,to:addCalendarDays(start,6)})]);
        if(!active)return;
        if(!r.ok)throw new Error(r.error);
        if(!e.ok)throw new Error(e.error);
        setRules(r.data);setExceptions(e.data);
      }catch(err){if(active)setError(err instanceof Error?err.message:"Could not load availability.");}
      finally{if(active)setLoading(false);}
    })();return()=>{active=false;};
  },[]);
  async function move(n: number) {if(!week)return;const next=addCalendarDays(week,n*7);setWeek(next);setBusy(true);setError("");try{await load(next);}catch(e){setError(e instanceof Error?e.message:"Unable to load this week.");}finally{setBusy(false);}}
  async function saveException(e: React.FormEvent) {
    e.preventDefault();setBusy(true);setError("");setNotice("");
    try {
      const r=await addAvailabilityException({date:day,isAvailable:available,reason:reason.trim()||null});
      if(!r.ok)throw new Error(r.error);
      setReason("");await load(week);
      setNotice("Availability exception saved.");
    }catch(err){setError(err instanceof Error?err.message:"Could not save availability.");}
    finally{setBusy(false);}
  }
  async function saveRule(e: React.FormEvent){
    e.preventDefault();setBusy(true);setError("");setNotice("");
    try{
      const minute=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3));
      const r=await upsertAvailabilityRule({dayOfWeek:weekday,startMinute:minute(from),endMinute:minute(to),isAvailable:weeklyAvailable});
      if(!r.ok)throw new Error(r.error);
      await load(week);setNotice("Weekly availability rule added.");
    }catch(err){setError(err instanceof Error?err.message:"Could not save weekly rule.");}
    finally{setBusy(false);}
  }
  const field="mt-2 w-full rounded-xl border border-[#DCE7DF] bg-white px-4 py-3 text-sm outline-none focus:border-[#238157] focus:ring-4 focus:ring-[#238157]/10";
  return <main className="min-h-screen bg-[#F5F9F5] px-5 py-9 text-[#1D3326]"><div className="mx-auto max-w-5xl">
    <Link href="/app/roster" className="inline-flex items-center gap-2 text-sm font-semibold text-[#176343]"><ArrowLeft size={17}/> Roster calendar</Link>
    <div className="mt-9"><span className="text-xs font-bold uppercase tracking-widest text-[#248357]">My schedule</span><h1 className="mt-2 text-4xl font-semibold tracking-tight">My availability.</h1><p className="mt-3 text-sm text-[#6C7C70]">Tell your team when you can and cannot work. Scheduling checks respect these restrictions.</p></div>
    {error&&<p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {notice&&<p role="status" className="mt-6 flex items-center gap-2 rounded-xl bg-[#E7F5E9] p-4 text-sm text-[#176343]"><CheckCircle2 size={18}/>{notice}</p>}
    {loading?<p className="mt-12 flex items-center gap-2 text-[#68796E]"><Loader2 size={20} className="animate-spin"/> Loading availability...</p>
    :<><section className="mt-8 rounded-3xl border border-[#DFE9E0] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarClock className="text-[#248357]" size={22}/> This week's availability</h2><div className="flex items-center gap-2"><button aria-label="Previous week" onClick={()=>{void move(-1);}} className="rounded-lg border border-[#DCE7DF] p-2"><ChevronLeft size={18}/></button><span className="text-sm font-semibold">{week}</span><button aria-label="Next week" onClick={()=>{void move(1);}} className="rounded-lg border border-[#DCE7DF] p-2"><ChevronRight size={18}/></button></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">{dates.map(date=>{
        const dow=new Date(date+"T12:00:00Z").getUTCDay();
        const ex=exceptions.filter(x=>x.date===date);
        const blocked=ex.some(x=>!x.isAvailable)||(!ex.length&&rules.some(r=>r.dayOfWeek===dow&&!r.isAvailable));
        return <button key={date} type="button" onClick={()=>setDay(date)} className={"rounded-2xl border p-4 text-left transition "+(day===date?"border-[#238157] ring-2 ring-[#238157]/20":blocked?"border-[#F0DFD8] bg-[#FFF6F2]":"border-[#DCE7DF] bg-[#F8FBF8]")}><p className="text-xs font-semibold">{dateLabel(date)}</p><p className={"mt-4 text-xs "+(blocked?"text-red-700":"text-[#557562]")}>{blocked?"Unavailable":ex.some(x=>x.isAvailable)?"Available":"No restriction"}</p></button>;
      })}</div>
    </section>
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <form onSubmit={saveException} className="rounded-3xl border border-[#DFE9E0] bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Set a date exception</h2><p className="mt-2 text-sm text-[#728376]">Block a day off or override your usual availability.</p>
        <label className="mt-5 block text-sm font-medium">Date<input className={field} required type="date" value={day} onChange={e=>setDay(e.target.value)}/></label>
        <label className="mt-4 block text-sm font-medium">Availability<select className={field} value={available?"available":"unavailable"} onChange={e=>setAvailable(e.target.value==="available")}><option value="unavailable">Unavailable</option><option value="available">Available</option></select></label>
        <label className="mt-4 block text-sm font-medium">Reason (optional)<input className={field} maxLength={200} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Personal appointment"/></label>
        <button disabled={busy} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#176343] px-5 py-3 font-semibold text-white disabled:opacity-50"><Plus size={18}/> Save exception</button>
      </form>
      <form onSubmit={saveRule} className="rounded-3xl border border-[#DFE9E0] bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Weekly rules</h2><p className="mt-2 text-sm text-[#728376]">Add a recurring working or blocked time window.</p>
        <label className="mt-5 block text-sm font-medium">Weekday<select className={field} value={weekday} onChange={e=>setWeekday(Number(e.target.value))}>{days.map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label>
        <div className="mt-4 grid grid-cols-2 gap-3"><label className="block text-sm font-medium">From<input className={field} type="time" required value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="block text-sm font-medium">To<input className={field} type="time" required value={to} onChange={e=>setTo(e.target.value)}/></label></div>
        <label className="mt-4 block text-sm font-medium">Rule<select className={field} value={weeklyAvailable?"available":"unavailable"} onChange={e=>setWeeklyAvailable(e.target.value==="available")}><option value="available">Available</option><option value="unavailable">Unavailable</option></select></label>
        <button disabled={busy} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#176343] px-5 py-3 font-semibold text-white disabled:opacity-50"><Plus size={18}/> Add weekly rule</button>
        <div className="mt-5 space-y-2 border-t border-[#E5ECE6] pt-4">{rules.length===0?<p className="text-xs text-[#879688]">No weekly rules yet.</p>:rules.map(r=><div key={r.id} className="flex justify-between rounded-lg bg-[#F4F9F4] px-3 py-2 text-xs"><span>{days[r.dayOfWeek]} {clock(r.startMinute)} – {clock(r.endMinute)}</span><strong className={r.isAvailable?"text-[#247F56]":"text-red-700"}>{r.isAvailable?"Available":"Blocked"}</strong></div>)}</div>
      </form>
    </div>
  </>}</div></main>;
}
