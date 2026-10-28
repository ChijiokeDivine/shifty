"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCopy, Loader2, Mail, ShieldCheck, UserPlus, XCircle } from "lucide-react";
import { createInvitation, listInvitations, revokeInvitation } from "@/lib/api/invitations";
import { listLocations, listPositions } from "@/lib/api/people";
import { getSessionContext } from "@/lib/api/session";
import type { Location, Position } from "@/lib/shiftii/types";

type Invitation = {
  id: string; email: string; role: string; status: string;
  expiresAt: string; createdAt: string;
};

export default function InviteStaffPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"EMPLOYEE" | "MANAGER" | "ADMIN">("EMPLOYEE");
  const [actorRole, setActorRole] = useState("");
  const [locationId, setLocationId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    const result = await listInvitations();
    if (result.ok) setInvitations(result.data);
    else setError(result.error);
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getSessionContext(), listLocations(), listPositions(), listInvitations()])
      .then(([ctx, locs, roles, invites]) => {
        if (cancelled) return;
        if (ctx.ok) setActorRole(ctx.data.membership.role);
        else setError(ctx.error);
        if (locs.ok) setLocations(locs.data);
        if (roles.ok) setPositions(roles.data);
        if (invites.ok) setInvitations(invites.data);
        else setError(invites.error);
      }).catch(() => { if (!cancelled) setError("Could not load your team. Try again."); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, []);

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setLink("");
    setBusy(true);
    try {
      const result = await createInvitation({
        email, role, locationId: locationId || null,
        positionIds: positionId ? [positionId] : [],
      });
      if (!result.ok) setError(result.error);
      else {
        setEmail("");
        // Never expose the token until a manager explicitly copies this link.
        setLink(`${window.location.origin}/invite/${result.data.token}`);
        setNotice("Invitation created. Copy and privately share the link. Email delivery is not enabled yet.");
        await refresh();
      }
    } catch {
      setError("Could not invite this team member.");
    } finally { setBusy(false); }
  }

  async function revoke(id: string) {
    setError("");
    const result = await revokeInvitation(id);
    if (!result.ok) setError(result.error);
    else {
      setNotice("Invitation revoked.");
      await refresh();
    }
  }

  const field = "mt-2 w-full rounded-xl border border-[#DCE6DE] bg-white px-4 py-3 outline-none focus:border-[#22794F] focus:ring-4 focus:ring-[#22794F]/10";
  return <main className="min-h-screen bg-[#F5F9F5] px-5 py-10 text-[#18251E]">
    <div className="mx-auto max-w-5xl">
      <Link href="/app" className="inline-flex items-center gap-2 text-sm font-medium text-[#237A51]"><ArrowLeft size={16}/> Back to workspace</Link>
      <div className="mt-9 flex flex-wrap items-start justify-between gap-4"><div><span className="text-xs font-bold uppercase tracking-widest text-[#247F56]">Team management</span><h1 className="mt-2 text-4xl font-semibold tracking-tight">Invite your team.</h1><p className="mt-3 text-[#687A6D]">Send a secure invitation so teammates can join your company workspace.</p></div><span className="rounded-full border border-[#CFE5D6] bg-[#EAF7EF] px-4 py-2 text-sm text-[#247F56]"><ShieldCheck size={16} className="mr-2 inline"/> Secure, single-use links</span></div>
      <div className="mt-9 grid gap-6 lg:grid-cols-[1fr_0.92fr]">
        <section className="rounded-3xl border border-[#E1EAE2] bg-white p-7 shadow-sm">
          <h2 className="flex items-center gap-2 text-xl font-semibold"><UserPlus size={21} className="text-[#247F56]"/> New invitation</h2>
          {checking ? <p className="mt-7 flex items-center gap-2 text-sm text-[#687A6D]"><Loader2 size={16} className="animate-spin"/> Loading...</p>
          : !["OWNER","ADMIN","MANAGER"].includes(actorRole) ? <p className="mt-6 text-sm text-[#687A6D]">Only organization managers and administrators can send invitations.</p>
          : <form onSubmit={invite} className="mt-7 space-y-5">
            <div><label htmlFor="invite-email" className="text-sm font-medium">Work email *</label><input id="invite-email" value={email} onChange={e=>setEmail(e.target.value)} required type="email" autoComplete="off" placeholder="employee@company.com" className={field}/></div>
            <div><label htmlFor="invite-role" className="text-sm font-medium">Access level</label><select id="invite-role" value={role} onChange={e=>setRole(e.target.value as typeof role)} className={field}><option value="EMPLOYEE">Employee</option>{actorRole !== "MANAGER" && <option value="MANAGER">Manager</option>}{actorRole === "OWNER" && <option value="ADMIN">Administrator</option>}</select></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="invite-location" className="text-sm font-medium">Location</label><select id="invite-location" value={locationId} onChange={e=>setLocationId(e.target.value)} className={field}><option value="">No location yet</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
              <div><label htmlFor="invite-position" className="text-sm font-medium">Position</label><select id="invite-position" value={positionId} onChange={e=>setPositionId(e.target.value)} className={field}><option value="">Assign later</option>{positions.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            </div>
            <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#176343] px-5 py-3.5 font-semibold text-white disabled:opacity-60">{busy ? <Loader2 size={18} className="animate-spin"/> : <Mail size={18}/>} Generate invite link <ArrowRight size={18}/></button>
          </form>}
          {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
          {notice && <p role="status" className="mt-5 rounded-xl bg-[#EAF7EF] p-4 text-sm text-[#176343]">{notice}</p>}
          {link && <div className="mt-5 rounded-xl border border-[#B7DDC5] bg-[#F4FBF5] p-4">
            <p className="text-sm font-semibold text-[#176343]">Invitation link (shown once)</p>
            <p className="mt-2 break-all text-xs text-[#4E6C58]">{link}</p>
            <button type="button" onClick={()=>{void navigator.clipboard.writeText(link).then(()=>setNotice("Link copied. Share it privately with the invited employee.")).catch(()=>setError("Copy failed. Select and copy the link manually."));}} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#176343] px-4 py-2 text-sm text-white"><ClipboardCopy size={15}/> Copy link</button>
          </div>}
        </section>
        <section className="rounded-3xl border border-[#E1EAE2] bg-white p-7 shadow-sm">
          <h2 className="text-xl font-semibold">Recent invitations</h2><p className="mt-2 text-sm text-[#687A6D]">Links expire after seven days.</p>
          {invitations.length === 0 ? <p className="mt-8 text-sm text-[#687A6D]">No invitations yet.</p> : <div className="mt-6 divide-y divide-[#E6EEE7]">
            {invitations.map(inv=><div key={inv.id} className="flex items-start justify-between gap-3 py-4"><div className="min-w-0"><p className="truncate text-sm font-semibold">{inv.email}</p><p className="mt-1 text-xs text-[#687A6D]">{inv.role.toLowerCase()} · {inv.status.toLowerCase()}</p><p className="mt-1 text-xs text-[#849486]">Expires {new Date(inv.expiresAt).toLocaleDateString()}</p></div>{inv.status === "PENDING" && <button type="button" onClick={()=>{void revoke(inv.id);}} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-red-600"><XCircle size={15}/> Revoke</button>}{inv.status === "ACCEPTED" && <CheckCircle2 className="text-[#247F56]" size={19}/>}</div>)}
          </div>}
        </section>
      </div>
    </div>
  </main>;
}