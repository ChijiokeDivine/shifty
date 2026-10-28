"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, GripVertical, Loader2, Plus, RefreshCw, Send, Users, X } from "lucide-react";
import { createRoster, createShift, listRosters, listShifts, publishRoster, assignShift, unassignShift, rescheduleShift, cancelShift, setOpenForClaim } from "@/lib/api/roster";
import { listStaff, listLocations, listPositions } from "@/lib/api/people";
import { getSessionContext } from "@/lib/api/session";
import { addCalendarDays, calendarDateInZone, shiftWindowFromClock, startOfCalendarWeek, timeOfDayInZone } from "@/lib/shiftii/calendar";
import type { MembershipRole, Organization, Shift, Location, Position } from "@/lib/shiftii/types";
import type { StaffRow } from "@/lib/shiftii/services/staff.server";

type RosterRow = { id: string; name: string; startDate: string; endDate: string; status: string; locationId: string | null };
type DragShift = { id: string; version: number };
const panel = "rounded-[22px] border border-[#DFEAE1] bg-white shadow-[0_14px_55px_rgba(35,80,48,0.045)]";
const field = "w-full rounded-xl border border-[#D9E6DC] bg-white px-3 py-3 text-sm text-[#1D3326] outline-none focus:border-[#238157] focus:ring-4 focus:ring-[#238157]/10";
const button = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#176343] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0F4B30] disabled:cursor-not-allowed disabled:opacity-50";

function formatDay(date: string, weekday?: string) {
  const d = new Date(date + "T12:00:00Z");
  return weekday === "short" ? d.toLocaleDateString("en-CA", { weekday: "short", timeZone: "UTC" }) : d.toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
}
function formatHours(start: string, end: string, zone: string) {
  return timeOfDayInZone(start, zone) + " – " + timeOfDayInZone(end, zone);
}

export default function RosterCalendar() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [myRole, setMyRole] = useState<MembershipRole>("EMPLOYEE");
  const [rosters, setRosters] = useState<RosterRow[]>([]);
  const [selectedRoster, setSelectedRoster] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [people, setPeople] = useState<StaffRow[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [weekStart, setWeekStart] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newRoster, setNewRoster] = useState(false);
  const [rosterName, setRosterName] = useState("");
  const [rosterStart, setRosterStart] = useState("");
  const [rosterEnd, setRosterEnd] = useState("");
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [createDate, setCreateDate] = useState("");
  const [shiftLocation, setShiftLocation] = useState("");
  const [shiftPosition, setShiftPosition] = useState("");
  const [shiftEmployee, setShiftEmployee] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [breakMinutes, setBreakMinutes] = useState(30);
  const [makeOpen, setMakeOpen] = useState(false);
  const [drag, setDrag] = useState<DragShift | null>(null);

  const selected = rosters.find(r => r.id === selectedRoster);
  const canManage = ["OWNER","ADMIN","MANAGER"].includes(myRole);
  const days = useMemo(() => weekStart ? Array.from({ length: 7 }, (_, i) => addCalendarDays(weekStart, i)) : [], [weekStart]);
  const visible = useMemo(() => shifts.filter(s => s.rosterId === selectedRoster && (!locationFilter || s.locationId === locationFilter)), [shifts, selectedRoster, locationFilter]);
  const summary = useMemo(() => ({
    assigned: visible.filter(s => s.employeeId && s.status !== "CANCELLED").length,
    open: visible.filter(s => s.isOpenForClaim && !s.employeeId && s.status !== "CANCELLED").length,
    total: visible.filter(s => s.status !== "CANCELLED").length,
  }), [visible]);

  const refresh = useCallback(async (from: string, rosterId?: string) => {
    const end = addCalendarDays(from, 6);
    const [rs, shiftsResult] = await Promise.all([listRosters(), listShifts({ from, to: end })]);
    if (!rs.ok) throw new Error(rs.error);
    if (!shiftsResult.ok) throw new Error(shiftsResult.error);
    setRosters(rs.data);
    setShifts(shiftsResult.data);
    if (rosterId && rs.data.some(r => r.id === rosterId)) setSelectedRoster(rosterId);
    else if (!rosterId && rs.data.length) setSelectedRoster(old => old && rs.data.some(r => r.id === old) ? old : rs.data[0].id);
  }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const [session, staff, locs, pos, cycles] = await Promise.all([getSessionContext(), listStaff(), listLocations(), listPositions(), listRosters()]);
        if (!live) return;
        for (const r of [session, staff, locs, pos, cycles]) if (!r.ok) throw new Error(r.error);
        if (!session.ok || !staff.ok || !locs.ok || !pos.ok || !cycles.ok) return;
        const zone = session.data.organization.timezone;
        const initial = startOfCalendarWeek(calendarDateInZone(new Date(), zone), session.data.organization.weekStartDay);
        setOrg(session.data.organization); setMyRole(session.data.membership.role);
        setPeople(staff.data); setLocations(locs.data); setPositions(pos.data); setRosters(cycles.data);
        setWeekStart(initial);
        setSelectedRoster(cycles.data[0]?.id ?? "");
        setRosterStart(initial); setRosterEnd(addCalendarDays(initial, 6));
        const result = await listShifts({ from: initial, to: addCalendarDays(initial, 6) });
        if (live) { if (!result.ok) throw new Error(result.error); setShifts(result.data); }
      } catch (e) { if (live) setError(e instanceof Error ? e.message : "Could not load roster."); }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, []);

  async function doWork(fn: () => Promise<void>, notice: string) {
    setBusy(true); setError(""); setSuccess("");
    try { await fn(); if (weekStart) await refresh(weekStart); setSuccess(notice); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save changes."); }
    finally { setBusy(false); }
  }

  async function changeWeek(weeks: number) {
    if (!weekStart) return;
    const next = addCalendarDays(weekStart, 7 * weeks);
    setWeekStart(next); setError(""); setBusy(true);
    try { await refresh(next); } catch (e) { setError(e instanceof Error ? e.message : "Could not change week."); }
    finally { setBusy(false); }
  }

  async function submitRoster(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const result = await createRoster({ name: rosterName.trim(), startDate: rosterStart, endDate: rosterEnd });
      if (!result.ok) throw new Error(result.error);
      setNewRoster(false); setRosterName("");
      const from = startOfCalendarWeek(rosterStart, org?.weekStartDay ?? 1);
      setWeekStart(from); await refresh(from, result.data.id);
      setSuccess("Draft roster created. You can now add shifts.");
    } catch(e) { setError(e instanceof Error ? e.message : "Could not create roster."); }
    finally { setBusy(false); }
  }

  function openNewShift(date: string) {
    setEditingShift(null); setCreateDate(date);
    setShiftLocation(selected?.locationId ?? locationFilter ?? locations[0]?.id ?? "");
    setShiftPosition(positions[0]?.id ?? "");
    setShiftEmployee(""); setStartTime("09:00"); setEndTime("17:00"); setBreakMinutes(30); setMakeOpen(false);
    setError("");
  }

  function openExisting(shift: Shift) {
    setEditingShift(shift); setCreateDate(shift.date); setShiftLocation(shift.locationId);
    setShiftPosition(shift.positionId); setShiftEmployee(shift.employeeId ?? "");
    setStartTime(timeOfDayInZone(shift.startAt, org?.timezone ?? "UTC"));
    setEndTime(timeOfDayInZone(shift.endAt, org?.timezone ?? "UTC"));
    setBreakMinutes(shift.breakMinutes); setMakeOpen(shift.isOpenForClaim); setError("");
  }

  async function saveShift(e: React.FormEvent) {
    e.preventDefault();
    if (!org || !selected) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      if (editingShift) {
        const change = await rescheduleShift({
          shiftId: editingShift.id, expectedVersion: editingShift.version,
          date: createDate, startTime, endTime,
        });
        if (!change.ok) throw new Error(change.error);
        if (shiftEmployee !== (editingShift.employeeId ?? "")) {
          if (shiftEmployee) {
            const assigned = await assignShift({ shiftId: editingShift.id, membershipId: shiftEmployee, expectedVersion: change.data.version });
            if (!assigned.ok) throw new Error(assigned.error);
          } else {
            const unassigned = await unassignShift({ shiftId: editingShift.id, openForClaim: makeOpen });
            if (!unassigned.ok) throw new Error(unassigned.error);
          }
        } else if (!shiftEmployee && makeOpen !== editingShift.isOpenForClaim) {
          const toggled = await setOpenForClaim({ shiftId: editingShift.id, open: makeOpen });
          if (!toggled.ok) throw new Error(toggled.error);
        }
        setSuccess("Shift updated.");
      } else {
        const times = shiftWindowFromClock(createDate, startTime, endTime, org.timezone);
        const made = await createShift({
          rosterId: selected.id, locationId: shiftLocation, positionId: shiftPosition,
          date: createDate, startAt: times.startAt, endAt: times.endAt,
          breakMinutes, employeeId: shiftEmployee || null,
          openForClaim: makeOpen && !shiftEmployee,
        });
        if (!made.ok) throw new Error(made.error);
        setSuccess("Shift created.");
      }
      setCreateDate(""); setEditingShift(null); await refresh(weekStart);
    } catch(err) { setError(err instanceof Error ? err.message : "Could not save shift."); }
    finally { setBusy(false); }
  }

  async function moveOrAssign(shift: Shift, date: string, memberId?: string) {
    if (!selected || selected.status !== "DRAFT" || !canManage) return;
    await doWork(async () => {
      let current = shift;
      if (date !== shift.date) {
        const updated = await rescheduleShift({ shiftId: shift.id, date, expectedVersion: shift.version });
        if (!updated.ok) throw new Error(updated.error);
        current = updated.data;
      }
      if (memberId && memberId !== current.employeeId) {
        const assigned = await assignShift({ shiftId: current.id, membershipId: memberId, expectedVersion: current.version });
        if (!assigned.ok) throw new Error(assigned.error);
      }
    }, "Shift moved. Scheduling rules checked.");
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>, date: string, memberId?: string) {
    event.preventDefault(); event.currentTarget.classList.remove("bg-[#EDF8EF]");
    const payload = drag;
    setDrag(null);
    if (!payload) return;
    const shift = visible.find(s => s.id === payload.id && s.version === payload.version);
    if (shift) void moveOrAssign(shift, date, memberId);
  }

  const perDay = (date: string) => visible.filter(s => s.date === date && s.status !== "CANCELLED");
  const rosterOptions = rosters.map(r => <option key={r.id} value={r.id}>{r.name} · {r.status.toLowerCase()}</option>);
  const disabledEdit = !canManage || selected?.status !== "DRAFT";

  return <main className="min-h-screen bg-[#F5F9F5] pb-20 text-[#1D3326]">
    <header className="border-b border-[#E1EAE2] bg-white"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-5 sm:px-7">
      <Link href="/app" className="flex items-center gap-2 text-sm font-medium text-[#176343]"><ArrowLeft size={17}/> Workspace</Link>
      <div className="flex items-center gap-2 text-xl font-bold tracking-tight text-[#176343]"><CalendarDays size={23}/> shiftii<span className="text-[#53B987]">.</span></div>
      <Link href="/app/availability" className="rounded-xl border border-[#DCE8DF] px-3 py-2 text-xs font-semibold text-[#176343] sm:text-sm">Availability</Link>
    </div></header>
    <div className="mx-auto max-w-[1500px] px-4 pt-9 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.17em] text-[#258358]">Workforce scheduling</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Roster calendar</h1><p className="mt-2 text-sm text-[#718275]">Plan schedules, assign teammates and publish shifts.</p></div>
        {canManage && <button disabled={busy} className={button} onClick={()=>{setNewRoster(true);setError("");}}><Plus size={17}/> New roster</button>}
      </div>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {success && <p role="status" className="mt-5 rounded-xl border border-[#BCE1C6] bg-[#EAF8ED] p-4 text-sm text-[#176343]">{success}</p>}
      {loading ? <div className="mt-12 flex items-center gap-3 text-[#718275]"><Loader2 size={21} className="animate-spin"/> Loading your schedule...</div>
      : <><section className={panel+" mt-7 p-4 sm:p-5"}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="min-w-[180px] flex-1 text-xs font-semibold text-[#55715C]">Roster<select className={field+" mt-2"} value={selectedRoster} onChange={e=>setSelectedRoster(e.target.value)}><option value="">Choose roster</option>{rosterOptions}</select></label>
          <label className="min-w-[150px] flex-1 text-xs font-semibold text-[#55715C]">Location<select className={field+" mt-2"} value={locationFilter} onChange={e=>setLocationFilter(e.target.value)}><option value="">All locations</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <div className="flex items-center gap-2 self-end"><button aria-label="Previous week" className="rounded-xl border border-[#DCE7DF] p-3" onClick={()=>{void changeWeek(-1);}}><ChevronLeft size={18}/></button><button aria-label="Next week" className="rounded-xl border border-[#DCE7DF] p-3" onClick={()=>{void changeWeek(1);}}><ChevronRight size={18}/></button></div>
          <button disabled={busy || !weekStart} onClick={()=>{void doWork(async()=>{await refresh(weekStart);},"Schedule refreshed.");}} className="self-end rounded-xl border border-[#DCE7DF] p-3" aria-label="Refresh calendar"><RefreshCw size={18}/></button>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#EEF3EF] pt-4 text-sm">
          <div><span className="font-semibold">{days.length ? formatDay(days[0]) + " – " + formatDay(days[6]) : ""}</span><span className="ml-3 text-[#829084]">{org?.timezone}</span></div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-[#EDF6EF] px-3 py-1.5 text-[#236444]">{summary.assigned} assigned</span>
            <span className="rounded-full bg-[#FFF4E6] px-3 py-1.5 text-[#936126]">{summary.open} open</span>
            <span className="rounded-full bg-[#F0F2F0] px-3 py-1.5 text-[#56695C]">{summary.total} shifts</span>
          </div>
        </div>
        {selected && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F5F9F5] px-4 py-3 text-sm"><div><strong>{selected.name}</strong><span className="ml-3 text-[#778579]">{selected.startDate} to {selected.endDate}</span><span className="ml-3 rounded-full bg-white px-2 py-1 text-xs font-semibold">{selected.status}</span></div>
          {selected.status === "DRAFT" && canManage && <button disabled={busy} className={button+" !py-2.5"} onClick={()=>{if(window.confirm("Publish this roster to all employees?")) void doWork(async()=>{const result=await publishRoster({rosterId:selected.id});if(!result.ok) throw new Error(result.error);},"Roster published. Employees can now see their shifts.");}}><Send size={16}/> Publish roster</button>}
        </div>}
      </section>
      <div className="mt-6 grid gap-3 lg:grid-cols-7">
        {days.map(date=><div key={date} className={panel+" flex min-h-[210px] flex-col overflow-hidden"} onDragOver={e=>{if(!disabledEdit)e.preventDefault();}} onDragEnter={e=>{if(!disabledEdit)e.currentTarget.classList.add("bg-[#EDF8EF]");}} onDragLeave={e=>e.currentTarget.classList.remove("bg-[#EDF8EF]")} onDrop={e=>handleDrop(e,date)}>
          <div className="flex items-center justify-between border-b border-[#ECF1ED] px-3 py-3"><div><p className="text-[11px] font-bold uppercase tracking-wider text-[#7B8B7F]">{formatDay(date,"short")}</p><p className="mt-1 text-lg font-semibold">{formatDay(date)}</p></div>{!disabledEdit && selected && date >= selected.startDate && date <= selected.endDate && <button className="rounded-lg bg-[#E6F3EA] p-2 text-[#176343] hover:bg-[#D3ECDA]" aria-label={"Create shift on "+date} onClick={()=>openNewShift(date)}><Plus size={18}/></button>}</div>
          <div className="flex flex-1 flex-col gap-2 p-2.5">
            {perDay(date).length === 0 && <p className="px-1 py-5 text-center text-xs text-[#A0AEA3]">No shifts</p>}
            {perDay(date).map(shift=><button key={shift.id} type="button" draggable={!disabledEdit} onDragStart={e=>{setDrag({id:shift.id,version:shift.version});e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",shift.id);}} onDragEnd={()=>setDrag(null)} onClick={()=>openExisting(shift)} className={"w-full rounded-xl border px-3 py-3 text-left transition hover:shadow-sm "+(shift.employeeId?"border-[#CAE3D2] bg-[#EAF6EC]":"border-[#EBDAC4] bg-[#FFF6E9]")}>
              <div className="flex items-center justify-between gap-1"><span className="truncate text-xs font-semibold">{shift.positionName || "Shift"}</span>{!disabledEdit && <GripVertical size={13} className="shrink-0 opacity-50"/>}</div>
              <p className="mt-2 text-xs font-medium">{formatHours(shift.startAt,shift.endAt,org?.timezone??"UTC")}</p>
              <p className="mt-1 truncate text-[11px] text-[#526956]">{shift.employeeName || (shift.isOpenForClaim?"Open for claims":"Unassigned")}</p>
              <p className="mt-1 truncate text-[10px] text-[#879788]">{shift.locationName}</p>
            </button>)}
          </div>
        </div>)}
      </div>
      {canManage && selected?.status === "DRAFT" && <section className={panel+" mt-6 p-5"}><h2 className="flex items-center gap-2 text-lg font-semibold"><Users size={20} className="text-[#238157]"/> Quick-assign by dragging</h2><p className="mt-2 text-sm text-[#738474]">Drag a shift onto an employee to assign it. Existing eligibility, leave, rest and overlap checks still apply.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">{people.map(person=><div key={person.id} className="min-h-14 rounded-xl border border-dashed border-[#C6DFCC] bg-[#F7FAF7] p-3 transition hover:bg-[#EDF8EF]" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const sh=visible.find(x=>x.id===drag?.id&&x.version===drag?.version);setDrag(null);if(sh)void moveOrAssign(sh,sh.date,person.id);}}><p className="text-sm font-semibold">{person.displayName}</p><p className="mt-1 text-xs text-[#758776]">{person.role.toLowerCase()}</p></div>)}</div>
      </section>}
      <p className="mt-4 text-xs leading-5 text-[#7D8E81]">Drag-and-drop and shift editing require a draft roster. Use the employee availability page to manage unavailable dates. Changes are validated on the server.</p>
      </>}
    </div>
    {(newRoster || createDate) && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#112A19]/55 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-label={newRoster?"Create roster":"Edit shift"} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
      <div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">{newRoster?"Create draft roster":editingShift?"Edit shift":"New shift"}</h2><button aria-label="Close" onClick={()=>{setNewRoster(false);setCreateDate("");setEditingShift(null);}}><X size={20}/></button></div>
      {newRoster?<form className="mt-6 space-y-4" onSubmit={submitRoster}><label className="block text-sm font-medium">Roster name<input required maxLength={120} className={field+" mt-2"} placeholder="November schedule" value={rosterName} onChange={e=>setRosterName(e.target.value)}/></label>
        <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Start date<input required type="date" className={field+" mt-2"} value={rosterStart} onChange={e=>setRosterStart(e.target.value)}/></label><label className="text-sm font-medium">End date<input required type="date" className={field+" mt-2"} value={rosterEnd} onChange={e=>setRosterEnd(e.target.value)}/></label></div><button disabled={busy} className={button+" w-full"}><Plus size={17}/> Create draft roster</button></form>
      :<form className="mt-6 space-y-4" onSubmit={saveShift}>
        <label className="block text-sm font-medium">Shift date<input className={field+" mt-2"} required type="date" disabled={disabledEdit} value={createDate} onChange={e=>setCreateDate(e.target.value)}/></label>
        {!editingShift && <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Location<select className={field+" mt-2"} required value={shiftLocation} onChange={e=>setShiftLocation(e.target.value)}>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label className="text-sm font-medium">Position<select className={field+" mt-2"} required value={shiftPosition} onChange={e=>setShiftPosition(e.target.value)}>{positions.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>}
        <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Start time<input required disabled={disabledEdit} type="time" className={field+" mt-2"} value={startTime} onChange={e=>setStartTime(e.target.value)}/></label><label className="text-sm font-medium">End time<input required disabled={disabledEdit} type="time" className={field+" mt-2"} value={endTime} onChange={e=>setEndTime(e.target.value)}/></label></div>
        {!editingShift && <label className="block text-sm font-medium">Break minutes<input min={0} max={240} required type="number" className={field+" mt-2"} value={breakMinutes} onChange={e=>setBreakMinutes(Number(e.target.value))}/></label>}
        <label className="block text-sm font-medium">Assigned employee<select disabled={disabledEdit} className={field+" mt-2"} value={shiftEmployee} onChange={e=>setShiftEmployee(e.target.value)}><option value="">Unassigned</option>{people.map(person=><option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
        {!shiftEmployee && <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={disabledEdit} checked={makeOpen} onChange={e=>setMakeOpen(e.target.checked)}/> Open for staff claims</label>}
        {editingShift && <p className="text-xs text-[#768777]">Location, position and break duration are fixed for an existing shift. Other changes require a draft roster.</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div className="flex flex-wrap gap-2">{!disabledEdit && <button disabled={busy} className={button+" flex-1"}><Clock3 size={16}/>{editingShift?"Save changes":"Create shift"}</button>}
          {editingShift && !disabledEdit && <button type="button" disabled={busy} onClick={()=>{if(!window.confirm("Cancel this shift?"))return;void doWork(async()=>{const r=await cancelShift({shiftId:editingShift.id});if(!r.ok)throw new Error(r.error);setEditingShift(null);setCreateDate("");},"Shift cancelled.");}} className="rounded-xl border border-[#F0D2D2] px-4 py-3 text-sm text-red-700">Cancel shift</button>}
        </div>
      </form>}
    </section></div>}
  </main>;
}
