"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, GripVertical, Plus, RefreshCw, Send, X } from "lucide-react";
import { assignShift, createRoster, createShift, listRosters, listShifts, moveCalendarShift, publishRoster, rescheduleShift } from "@/lib/api/roster";
import { listLocations, listPositions, listStaff } from "@/lib/api/people";
import { getSessionContext } from "@/lib/api/session";
import { addCalendarDays, calendarDateInZone, shiftWindowFromClock, startOfCalendarWeek, timeOfDayInZone } from "@/lib/shiftii/calendar";
import type { Location, MembershipRole, Organization, Position, Shift } from "@/lib/shiftii/types";
import type { StaffRow } from "@/lib/shiftii/services/staff.server";

type Roster = { id:string; name:string; startDate:string; endDate:string; status:string; locationId:string|null };
const surface = "rounded-2xl border border-[#111110]/10 bg-[#F6F4EF]";
const input = "w-full rounded-md border border-[#111110]/20 bg-white/70 px-3 py-3 text-sm text-[#111110] outline-none focus:border-[#111110]";
const primary = "inline-flex items-center justify-center gap-2 rounded-md bg-[#111110] px-5 py-3 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40";
const secondary = "inline-flex items-center justify-center gap-2 rounded-md border border-[#111110]/30 px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 disabled:opacity-40";
const stamp = (s:string) => new Date(s+"T12:00:00Z").toLocaleDateString("en-CA",{weekday:"short",month:"short",day:"numeric",timeZone:"UTC"});

export default function RosterPage() {
  const [org,setOrg] = useState<Organization|null>(null);
  const [role,setRole] = useState<MembershipRole>("EMPLOYEE");
  const [rosters,setRosters] = useState<Roster[]>([]);
  const [selectedId,setSelectedId] = useState("");
  const [locations,setLocations] = useState<Location[]>([]);
  const [positions,setPositions] = useState<Position[]>([]);
  const [people,setPeople] = useState<StaffRow[]>([]);
  const [shifts,setShifts] = useState<Shift[]>([]);
  const [week,setWeek] = useState("");
  const [filter,setFilter] = useState("");
  const [loading,setLoading] = useState(true);
  const [working,setWorking] = useState(false);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");
  const [newRoster,setNewRoster] = useState(false);
  const [name,setName] = useState("");
  const [startDate,setStartDate] = useState("");
  const [endDate,setEndDate] = useState("");
  const [shiftDate,setShiftDate] = useState("");
  const [shiftLocation,setShiftLocation] = useState("");
  const [shiftPosition,setShiftPosition] = useState("");
  const [shiftEmployee,setShiftEmployee] = useState("");
  const [startTime,setStartTime] = useState("09:00");
  const [endTime,setEndTime] = useState("17:00");
  const [breakMinutes,setBreakMinutes] = useState(30);
  const [dragId,setDragId] = useState("");

  const canManage = ["OWNER","ADMIN","MANAGER"].includes(role);
  const selected = rosters.find(r=>r.id===selectedId);
  const days = useMemo(()=>week?Array.from({length:7},(_,i)=>addCalendarDays(week,i)):[],[week]);
  const visible = useMemo(()=>shifts.filter(s=>s.rosterId===selectedId&&(!filter||s.locationId===filter)&&s.status!=="CANCELLED"),[shifts,selectedId,filter]);
  const refresh = useCallback(async (date:string) => {
    const [rs,ss] = await Promise.all([listRosters(),listShifts({from:date,to:addCalendarDays(date,6)})]);
    if(!rs.ok) throw new Error(rs.error);
    if(!ss.ok) throw new Error(ss.error);
    setRosters(rs.data);
    setShifts(ss.data);
    setSelectedId(old=>rs.data.some(r=>r.id===old)?old:(rs.data[0]?.id??""));
  },[]);

  useEffect(()=>{
    let live=true;
    void (async()=>{
      try{
        const [ctx,rs,loc,pos,staff]=await Promise.all([getSessionContext(),listRosters(),listLocations(),listPositions(),listStaff()]);
        if(!live)return;
        if(!ctx.ok)throw new Error(ctx.error);
        if(!rs.ok)throw new Error(rs.error);
        if(!loc.ok)throw new Error(loc.error);
        if(!pos.ok)throw new Error(pos.error);
        if(!staff.ok)throw new Error(staff.error);
        const organization=ctx.data.organization;
        const initial=startOfCalendarWeek(calendarDateInZone(new Date(),organization.timezone),organization.weekStartDay);
        setOrg(organization);setRole(ctx.data.membership.role);setWeek(initial);
        setStartDate(initial);setEndDate(addCalendarDays(initial,6));
        setRosters(rs.data);setSelectedId(rs.data[0]?.id??"");
        setLocations(loc.data);setPositions(pos.data);setPeople(staff.data);
        const ss=await listShifts({from:initial,to:addCalendarDays(initial,6)});
        if(!ss.ok)throw new Error(ss.error);
        if(live)setShifts(ss.data);
      }catch(e){if(live)setError(e instanceof Error?e.message:"Unable to load roster.");}
      finally{if(live)setLoading(false);}
    })();
    return()=>{live=false;};
  },[]);

  async function act(job:()=>Promise<void>,success:string) {
    setWorking(true);setError("");setMessage("");
    try{await job();if(week)await refresh(week);setMessage(success);}
    catch(e){setError(e instanceof Error?e.message:"Unable to save change.");}
    finally{setWorking(false);}
  }
  async function navigate(offset:number){
    if(!week)return;
    const next=addCalendarDays(week,7*offset);
    setWorking(true);setError("");
    try{await refresh(next);setWeek(next);}
    catch(e){setError(e instanceof Error?e.message:"Unable to load week.");}
    finally{setWorking(false);}
  }
  async function makeRoster(e:React.FormEvent) {
    e.preventDefault();
    await act(async()=>{
      const r=await createRoster({name,startDate,endDate});
      if(!r.ok)throw new Error(r.error);
      setNewRoster(false);setName("");
      const first=startOfCalendarWeek(startDate,org?.weekStartDay??1);
      setWeek(first);await refresh(first);setSelectedId(r.data.id);
    },"Draft roster created.");
  }
  async function makeShift(e:React.FormEvent) {
    e.preventDefault();
    if(!org||!selected)return;
    await act(async()=>{
      const times=shiftWindowFromClock(shiftDate,startTime,endTime,org.timezone);
      const r=await createShift({rosterId:selected.id,locationId:shiftLocation,positionId:shiftPosition,date:shiftDate,startAt:times.startAt,endAt:times.endAt,breakMinutes,employeeId:shiftEmployee||null});
      if(!r.ok)throw new Error(r.error);
      setShiftDate("");
    },"Shift created.");
  }
  async function drop(date:string,employeeId?:string) {
    const shift=visible.find(s=>s.id===dragId);
    setDragId("");
    if(!shift||working||!selected||selected.status!=="DRAFT"||!canManage)return;
    await act(async()=>{
      const r=await moveCalendarShift({shiftId:shift.id,date,expectedVersion:shift.version,membershipId:employeeId||undefined});
      if(!r.ok)throw new Error(r.error);
    },"Shift updated. Scheduling constraints checked.");
  }
  const weekLabel=days.length?`${stamp(days[0])} - ${stamp(days[6])}`:"";
  return <main className="min-h-screen bg-[#CCDBD6] text-[#111110]">
    <header className="border-b border-[#111110]/15"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
      <Link href="/app" className="inline-flex items-center gap-2 text-sm"><ArrowLeft size={17}/> Workspace</Link>
      <Link href="/" className="font-serif text-[28px] leading-none">Shifti</Link>
      <Link className="text-sm underline underline-offset-4" href="/app/availability">Availability</Link>
    </div></header>
    <div className="mx-auto max-w-7xl px-6 pb-24 pt-12 lg:px-10 lg:pt-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div><p className="text-xs uppercase tracking-[0.16em] text-[#111110]/60">Staff scheduling</p>
          <h1 className="font-serif mt-4 text-5xl font-normal leading-none tracking-tight sm:text-6xl">The roster.</h1>
          <p className="mt-4 max-w-xl text-[15px] text-[#111110]/70">Plan the week, assign the right people, and publish when your schedule is ready.</p>
        </div>
        {canManage&&<button className={primary} disabled={working} onClick={()=>setNewRoster(true)}><Plus size={17}/> Create roster</button>}
      </div>
      {error&&<p role="alert" className="mt-7 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error}</p>}
      {message&&<p role="status" className="mt-7 rounded-md border border-[#111110]/15 bg-white/65 p-4 text-sm">{message}</p>}
      {loading?<p className="mt-14 text-sm">Loading calendar...</p>:<>
        <section className={surface+" mt-10 p-5 sm:p-6"}>
          <div className="grid gap-4 md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto] md:items-end">
            <label className="text-xs font-medium">Roster<select className={input+" mt-2"} value={selectedId} onChange={e=>setSelectedId(e.target.value)}><option value="">Select roster</option>{rosters.map(r=><option key={r.id} value={r.id}>{r.name} ({r.status.toLowerCase()})</option>)}</select></label>
            <label className="text-xs font-medium">Location<select className={input+" mt-2"} value={filter} onChange={e=>setFilter(e.target.value)}><option value="">All locations</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
            <div className="flex items-center gap-2"><button disabled={working} className={secondary} aria-label="Previous week" onClick={()=>void navigate(-1)}><ChevronLeft size={18}/></button><button disabled={working} className={secondary} aria-label="Next week" onClick={()=>void navigate(1)}><ChevronRight size={18}/></button><button disabled={working} className={secondary} aria-label="Refresh" onClick={()=>void act(()=>refresh(week),"Schedule refreshed.")}><RefreshCw size={17}/></button></div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#111110]/10 pt-5">
            <p className="text-lg font-medium">{weekLabel}<span className="ml-3 text-xs font-normal text-[#111110]/60">{org?.timezone}</span></p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#111110]/70"><span>{visible.length} shifts</span><span>{visible.filter(s=>s.employeeId).length} assigned</span><span>{visible.filter(s=>!s.employeeId).length} unassigned</span></div>
          </div>
          {selected&&<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#111110]/10 pt-4 text-sm"><p><strong>{selected.name}</strong> <span className="ml-3 text-[#111110]/60">{selected.startDate} to {selected.endDate} · {selected.status.toLowerCase()}</span></p>{canManage&&selected.status==="DRAFT"&&<button className={primary} disabled={working} onClick={()=>{if(window.confirm("Publish this roster to employees?"))void act(async()=>{const r=await publishRoster({rosterId:selected.id});if(!r.ok)throw new Error(r.error);},"Roster published.");}}><Send size={15}/> Publish</button>}</div>}
        </section>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {days.map(day=><div key={day} className={surface+" min-h-52 overflow-hidden"} onDragOver={e=>{if(canManage&&selected?.status==="DRAFT")e.preventDefault();}} onDrop={e=>{e.preventDefault();void drop(day);}}>
            <div className="flex items-center justify-between border-b border-[#111110]/10 px-3 py-3"><span className="text-xs font-medium">{stamp(day)}</span>{canManage&&selected?.status==="DRAFT"&&day>=selected.startDate&&day<=selected.endDate&&<button aria-label={"New shift "+day} onClick={()=>{setShiftDate(day);setShiftLocation(selected.locationId||locations[0]?.id||"");setShiftPosition(positions[0]?.id||"");setShiftEmployee("");}}><Plus size={17}/></button>}</div>
            <div className="space-y-2 p-2">{visible.filter(s=>s.date===day).map(s=><div key={s.id} draggable={canManage&&selected?.status==="DRAFT"&&!working} onDragStart={e=>{setDragId(s.id);e.dataTransfer.setData("text/plain",s.id);}} onDragEnd={()=>setDragId("")} className="cursor-grab rounded-md border border-[#111110]/10 bg-white/80 p-3 text-left text-xs active:cursor-grabbing">
              <div className="flex items-center justify-between gap-1"><strong className="truncate">{s.positionName||"Shift"}</strong><GripVertical size={13} className="shrink-0 opacity-40"/></div>
              <p className="mt-2">{org?timeOfDayInZone(s.startAt,org.timezone):""} - {org?timeOfDayInZone(s.endAt,org.timezone):""}</p>
              <p className="mt-2 truncate text-[#111110]/65">{s.employeeName||"Open shift"}</p>
              <p className="mt-1 truncate text-[#111110]/50">{s.locationName}</p>
            </div>)}{!visible.some(s=>s.date===day)&&<p className="py-7 text-center text-xs text-[#111110]/40">No shifts</p>}</div>
          </div>)}
        </div>
        {canManage&&selected?.status==="DRAFT"&&<section className={surface+" mt-6 p-6"}>
          <h2 className="font-serif text-2xl">Assign your team</h2><p className="mt-2 text-sm text-[#111110]/60">Drag a shift onto a team member to assign it. Eligibility rules are checked before saving.</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{people.map(p=><div key={p.id} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const shift=visible.find(s=>s.id===dragId);if(shift)void drop(shift.date,p.id);}} className="flex items-center gap-3 rounded-lg border border-[#111110]/15 bg-white/65 p-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#CCDBD6] text-xs font-medium">{p.initials}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{p.displayName}</p><p className="truncate text-xs text-[#111110]/60">{p.positionNames.join(", ")||"Unassigned role"}</p></div></div>)}</div>
        </section>}
        {!rosters.length&&<p className="mt-10 text-sm text-[#111110]/60">No rosters yet. Create the first draft to begin scheduling.</p>}
      </>}
    </div>
    {(newRoster||shiftDate)&&<div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#111110]/55 px-4 py-6"><section role="dialog" aria-modal="true" aria-labelledby="form-title" className="w-full max-w-lg rounded-2xl bg-[#F6F4EF] p-7 text-[#111110] shadow-2xl">
      <div className="flex items-center justify-between gap-3"><h2 id="form-title" className="font-serif text-3xl">{newRoster?"New roster":"Create a shift"}</h2><button aria-label="Close" onClick={()=>{setNewRoster(false);setShiftDate("");}}><X size={19}/></button></div>
      {newRoster?<form className="mt-6 space-y-4" onSubmit={e=>void makeRoster(e)}><label className="block text-sm">Name<input className={input+" mt-2"} required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="November schedule"/></label><div className="grid grid-cols-2 gap-3"><label className="block text-sm">Start date<input type="date" required className={input+" mt-2"} value={startDate} onChange={e=>setStartDate(e.target.value)}/></label><label className="block text-sm">End date<input type="date" required className={input+" mt-2"} value={endDate} onChange={e=>setEndDate(e.target.value)}/></label></div><button disabled={working} className={primary+" w-full"}>Create draft <ArrowRight size={15}/></button></form>
      :<form className="mt-6 space-y-4" onSubmit={e=>void makeShift(e)}><p className="text-sm text-[#111110]/60">{stamp(shiftDate)}</p><div className="grid grid-cols-2 gap-3"><label className="text-sm">Start<input required type="time" className={input+" mt-2"} value={startTime} onChange={e=>setStartTime(e.target.value)}/></label><label className="text-sm">End<input required type="time" className={input+" mt-2"} value={endTime} onChange={e=>setEndTime(e.target.value)}/></label></div><label className="block text-sm">Location<select required className={input+" mt-2"} value={shiftLocation} onChange={e=>setShiftLocation(e.target.value)}>{locations.map(l=><option value={l.id} key={l.id}>{l.name}</option>)}</select></label><label className="block text-sm">Position<select required className={input+" mt-2"} value={shiftPosition} onChange={e=>setShiftPosition(e.target.value)}>{positions.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label className="block text-sm">Employee<select className={input+" mt-2"} value={shiftEmployee} onChange={e=>setShiftEmployee(e.target.value)}><option value="">Leave unassigned</option>{people.map(p=><option key={p.id} value={p.id}>{p.displayName}</option>)}</select></label><label className="block text-sm">Break (minutes)<input className={input+" mt-2"} type="number" min={0} max={240} value={breakMinutes} onChange={e=>setBreakMinutes(Number(e.target.value))}/></label><button disabled={working} className={primary+" w-full"}>Save shift <ArrowRight size={15}/></button></form>}
      {error&&<p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}
    </section></div>}
  </main>;
}
