"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Loader2, MapPin, Pencil, Plus, UserMinus, Users } from "lucide-react";
import { createLocation, createPosition, deactivateStaff, listLocations, listPositions, listStaff, updateStaffProfile } from "@/lib/api/people";
import { getSessionContext } from "@/lib/api/session";
import type { Location, MembershipRole, Position } from "@/lib/shiftii/types";

type StaffRow = Awaited<ReturnType<typeof listStaff>> extends { ok: true; data: infer U }
  ? U extends (infer R)[] ? R : never : never;

export default function TeamPage() {
  const [members, setMembers] = useState<StaffRow[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [actorRole, setActorRole] = useState<MembershipRole | null>(null);
  const [selected, setSelected] = useState<StaffRow | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MANAGER" | "EMPLOYEE">("EMPLOYEE");
  const [hours, setHours] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function reload() {
    const [staff, locs, pos] = await Promise.all([listStaff(), listLocations(), listPositions()]);
    if (!staff.ok) throw new Error(staff.error);
    if (!locs.ok) throw new Error(locs.error);
    if (!pos.ok) throw new Error(pos.error);
    setMembers(staff.data);
    setLocations(locs.data);
    setPositions(pos.data);
  }
  useEffect(() => {
    let active = true;
    void Promise.all([getSessionContext(), listStaff(), listLocations(), listPositions()])
      .then(([ctx, staff, locs, pos]) => {
        if (!active) return;
        if (!ctx.ok) throw new Error(ctx.error);
        if (!staff.ok) throw new Error(staff.error);
        if (!locs.ok) throw new Error(locs.error);
        if (!pos.ok) throw new Error(pos.error);
        setActorRole(ctx.data.membership.role);
        setMembers(staff.data);
        setLocations(locs.data);
        setPositions(pos.data);
      })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Couldn't load your team."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  function edit(member: StaffRow) {
    setSelected(member);
    setName(member.displayName);
    setRole(member.role === "OWNER" ? "EMPLOYEE" : member.role);
    setHours(member.targetWeeklyHours === null ? "" : String(member.targetWeeklyHours));
    // A single primary location and position can be chosen in this editor.
    // Existing multi-location assignments are preserved until updated in a
    // dedicated multi-assignment editor.
    setSelectedLocation("");
    setSelectedPosition("");
    setError("");
    setNotice("");
  }
  const canManage = actorRole === "OWNER" || actorRole === "ADMIN" || actorRole === "MANAGER";
  const canEdit = (member: StaffRow) =>
    canManage && member.role !== "OWNER" &&
    (actorRole === "OWNER" || (actorRole === "ADMIN" && member.role !== "ADMIN") || (actorRole === "MANAGER" && member.role === "EMPLOYEE"));

  async function save() {
    if (!selected) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const patch: Parameters<typeof updateStaffProfile>[0] = {
        membershipId: selected.id, displayName: name,
        targetWeeklyHours: hours.trim() ? Number(hours) : null,
        role,
      };
      // Only replace a relationship if an explicit new choice was made.
      if (selectedLocation) {
        patch.locationIds = [selectedLocation];
        patch.primaryLocationId = selectedLocation;
      }
      if (selectedPosition) patch.positionIds = [selectedPosition];
      const res = await updateStaffProfile(patch);
      if (!res.ok) throw new Error(res.error);
      await reload();
      setSelected(null);
      setNotice("Team member updated successfully.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save changes."); }
    finally { setSaving(false); }
  }
  async function deactivate() {
    if (!selected || !window.confirm(`Deactivate ${selected.displayName}? This removes their workspace access.`)) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const res = await deactivateStaff({ membershipId: selected.id });
      if (!res.ok) throw new Error(res.error);
      await reload();
      setSelected(null);
      setNotice("Team member deactivated.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to deactivate staff member."); }
    finally { setSaving(false); }
  }
  async function addItem(kind: "location" | "position") {
    setSaving(true); setError(""); setNotice("");
    try {
      const value = kind === "location" ? newLocation : newPosition;
      const res = kind === "location" ? await createLocation({ name: value }) : await createPosition({ name: value });
      if (!res.ok) throw new Error(res.error);
      if (kind === "location") setNewLocation(""); else setNewPosition("");
      await reload();
      setNotice(`${kind === "location" ? "Location" : "Position"} created.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create item."); }
    finally { setSaving(false); }
  }
  const field = "mt-2 w-full rounded-xl border border-[#DCE7DF] bg-white px-4 py-3 text-sm outline-none focus:border-[#277E57] focus:ring-4 focus:ring-[#277E57]/10";
  return <main className="min-h-screen bg-[#F5F9F5] px-5 py-9 text-[#18251E]">
    <div className="mx-auto max-w-6xl">
      <Link href="/app" className="inline-flex items-center gap-2 text-sm font-medium text-[#176343]"><ArrowLeft size={17}/> Workspace</Link>
      <div className="mt-9 flex flex-wrap items-center justify-between gap-4">
        <div><span className="text-xs font-semibold uppercase tracking-widest text-[#248357]">People and locations</span><h1 className="mt-2 text-4xl font-semibold tracking-tight">Your team.</h1><p className="mt-3 text-[#68796E]">Manage employees, permissions, locations and positions.</p></div>
        {canManage && <Link href="/app/invitations" className="inline-flex items-center gap-2 rounded-xl bg-[#176343] px-5 py-3 font-semibold text-white"><Plus size={18}/> Invite employee <ArrowRight size={16}/></Link>}
      </div>
      {error && <p role="alert" className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-6 flex items-center gap-2 rounded-xl bg-[#EAF7EF] p-4 text-sm text-[#176343]"><CheckCircle2 size={18}/>{notice}</p>}
      {loading ? <div className="mt-14 flex items-center gap-3 text-[#68796E]"><Loader2 size={20} className="animate-spin"/> Loading team...</div> : <>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#E0E9E1] bg-white p-5"><Users size={21} className="text-[#248357]"/><p className="mt-4 text-3xl font-semibold">{members.length}</p><p className="mt-1 text-sm text-[#68796E]">Active employees</p></div>
          <div className="rounded-2xl border border-[#E0E9E1] bg-white p-5"><MapPin size={21} className="text-[#248357]"/><p className="mt-4 text-3xl font-semibold">{locations.length}</p><p className="mt-1 text-sm text-[#68796E]">Locations</p></div>
          <div className="rounded-2xl border border-[#E0E9E1] bg-white p-5"><Building2 size={21} className="text-[#248357]"/><p className="mt-4 text-3xl font-semibold">{positions.length}</p><p className="mt-1 text-sm text-[#68796E]">Job positions</p></div>
        </div>
        <section className="mt-6 overflow-hidden rounded-2xl border border-[#E0E9E1] bg-white">
          <div className="border-b border-[#E8EEE8] p-6"><h2 className="text-xl font-semibold">Team directory</h2><p className="mt-1 text-sm text-[#68796E]">Staff accounts currently active in your organization.</p></div>
          <div className="divide-y divide-[#EBF0EB]">
            {members.length === 0 && <p className="p-6 text-sm text-[#68796E]">No staff accounts yet. Invite your first employee to get started.</p>}
            {members.map(member=><div key={member.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#E4F3EA] text-sm font-semibold text-[#176343]">{member.initials}</span><div className="min-w-0"><p className="truncate font-semibold">{member.displayName}</p><p className="mt-1 text-xs text-[#68796E]">{member.role.toLowerCase()} · {member.positionNames.join(", ") || "No position"} · {member.locationNames.join(", ") || "No location"}</p></div></div>
              {canEdit(member) && <button onClick={()=>edit(member)} className="inline-flex items-center gap-2 rounded-lg border border-[#DCE7DF] px-4 py-2 text-sm font-medium text-[#176343] hover:bg-[#F5F9F5]"><Pencil size={15}/> Edit</button>}
            </div>)}
          </div>
        </section>
        {canManage && <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <form onSubmit={e=>{e.preventDefault(); void addItem("location");}} className="rounded-2xl border border-[#E0E9E1] bg-white p-6"><h2 className="text-lg font-semibold">Add a location</h2><p className="mt-1 text-sm text-[#68796E]">Create a department, branch or scheduling unit.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><input aria-label="Location name" className={field+" mt-0"} required maxLength={100} value={newLocation} onChange={e=>setNewLocation(e.target.value)} placeholder="e.g. Main Branch"/><button disabled={saving} className="rounded-xl bg-[#176343] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">Create</button></div></form>
          <form onSubmit={e=>{e.preventDefault(); void addItem("position");}} className="rounded-2xl border border-[#E0E9E1] bg-white p-6"><h2 className="text-lg font-semibold">Add a position</h2><p className="mt-1 text-sm text-[#68796E]">Define a job role for scheduling.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><input aria-label="Position name" className={field+" mt-0"} required maxLength={100} value={newPosition} onChange={e=>setNewPosition(e.target.value)} placeholder="e.g. Front Desk"/><button disabled={saving} className="rounded-xl bg-[#176343] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">Create</button></div></form>
        </section>}
      </>}
      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#14221A]/50 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="staff-title" className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-center justify-between"><h2 id="staff-title" className="text-2xl font-semibold">Edit employee</h2><button aria-label="Close" onClick={()=>setSelected(null)} className="text-[#68796E]">✕</button></div>
        <p className="mt-2 text-sm text-[#68796E]">Change the details of {selected.displayName}.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium sm:col-span-2">Display name<input className={field} required value={name} onChange={e=>setName(e.target.value)}/></label>
          <label className="text-sm font-medium">Access role<select className={field} value={role} onChange={e=>setRole(e.target.value as typeof role)}><option value="EMPLOYEE">Employee</option>{actorRole !== "MANAGER" && <option value="MANAGER">Manager</option>}{actorRole === "OWNER" && <option value="ADMIN">Administrator</option>}</select></label>
          <label className="text-sm font-medium">Target weekly hours<input type="number" min={0} max={168} step={0.5} className={field} value={hours} onChange={e=>setHours(e.target.value)} placeholder="Not set"/></label>
          <label className="text-sm font-medium">Change primary location<select className={field} value={selectedLocation} onChange={e=>setSelectedLocation(e.target.value)}><option value="">Keep existing</option>{locations.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label className="text-sm font-medium">Change position<select className={field} value={selectedPosition} onChange={e=>setSelectedPosition(e.target.value)}><option value="">Keep existing</option>{positions.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        </div>
        <p className="mt-3 text-xs text-[#68796E]">Choosing a new location or position replaces that employee&apos;s current assignments.</p>
        {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3"><button disabled={saving} onClick={()=>{void deactivate();}} className="inline-flex items-center gap-2 text-sm font-medium text-red-700"><UserMinus size={16}/> Deactivate</button><div className="flex gap-2"><button onClick={()=>setSelected(null)} className="rounded-xl border border-[#DCE7DF] px-4 py-3 text-sm">Cancel</button><button disabled={saving} onClick={()=>{void save();}} className="rounded-xl bg-[#176343] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Save changes"}</button></div></div>
      </section></div>}
    </div>
  </main>;
}
