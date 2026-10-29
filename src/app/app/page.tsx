"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Building2, Users, Loader2, Clock3, LogOut } from "lucide-react";
import { getSessionContext } from "@/lib/api/session";
import { listRosters } from "@/lib/api/roster";
import { listStaff } from "@/lib/api/people";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { signOut } from "@/lib/auth/client";
import type { Membership, Organization } from "@/lib/shiftii/types";

export default function WorkspacePage() {
  const { user, isPending } = useCurrentUserState();
  const [org, setOrg] = useState<Organization | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [rosters, setRosters] = useState(0);
  const [staff, setStaff] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasCompany, setHasCompany] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const result = await getSessionContext();
        if (!active) return;
        if (!result.ok) {
          if (result.code === "NOT_FOUND") {
            setHasCompany(false);
          } else {
            setError(result.error);
          }
          return;
        }
        setOrg(result.data.organization);
        setMembership(result.data.membership);
        const [rostersResult, staffResult] = await Promise.all([listRosters(), listStaff()]);
        if (!active) return;
        if (rostersResult.ok) setRosters(rostersResult.data.length);
        if (staffResult.ok) setStaff(staffResult.data.length);
      } catch {
        if (active) setError("Could not load your company. Try again.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user?.id, isPending]);

  return <main className="min-h-screen bg-[#F5F9F5] text-[#17251E]">
    <header className="border-b border-[#E0E9E1] bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
      <Link href="/" className="text-2xl font-semibold text-[#176343]">shiftii<span className="text-[#58B785]">.</span></Link>
      <div className="flex items-center gap-4"><span className="hidden text-sm text-[#68796E] sm:inline">{user?.displayName ?? ""}</span><button onClick={()=>{void signOut("/login");}} className="flex items-center gap-2 rounded-lg border border-[#DDE8DF] px-3 py-2 text-sm"><LogOut size={16}/> Sign out</button></div>
    </div></header>
    <div className="mx-auto max-w-6xl px-6 py-14">
      {isPending || loading ? <div className="flex items-center gap-3 text-[#69796E]"><Loader2 className="animate-spin" size={20}/> Loading your workspace...</div>
      : !user ? <div><h1 className="text-3xl font-semibold">Sign in to Shiftii</h1><Link href="/login" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#176343] px-5 py-3 text-white">Sign in <ArrowRight size={18}/></Link></div>
      : !hasCompany ? <div className="max-w-xl rounded-3xl border border-[#E0E9E1] bg-white p-9">
        <Building2 size={32} className="text-[#248357]"/><h1 className="mt-5 text-3xl font-semibold">Let's set up your company.</h1><p className="mt-3 text-[#68796E]">Your account is ready. Create a company workspace to start scheduling your team.</p><Link href="/onboarding" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#176343] px-6 py-3 text-white">Create your company <ArrowRight size={18}/></Link>
      </div> : error ? <p role="alert" className="rounded-xl bg-red-50 p-5 text-red-800">{error}</p>
      : <><span className="text-xs font-semibold uppercase tracking-widest text-[#248357]">Company workspace</span><h1 className="mt-3 text-4xl font-semibold tracking-tight">Welcome to {org?.name}</h1><p className="mt-3 text-[#68796E]">Your team is ready to start building better schedules.</p>
        <div className="mt-9 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#E0E9E1] bg-white p-6"><Building2 className="text-[#248357]" size={22}/><p className="mt-5 text-3xl font-semibold">1</p><p className="mt-1 text-sm text-[#68796E]">Company</p></div>
          <div className="rounded-2xl border border-[#E0E9E1] bg-white p-6"><Users className="text-[#248357]" size={22}/><p className="mt-5 text-3xl font-semibold">{staff}</p><p className="mt-1 text-sm text-[#68796E]">Active team members</p></div>
          <div className="rounded-2xl border border-[#E0E9E1] bg-white p-6"><CalendarDays className="text-[#248357]" size={22}/><p className="mt-5 text-3xl font-semibold">{rosters}</p><p className="mt-1 text-sm text-[#68796E]">Roster periods</p></div>
        </div>
        <div className="mt-9 rounded-2xl border border-[#E0E9E1] bg-white p-7">
          <h2 className="text-xl font-semibold">You're in charge of your workspace.</h2><p className="mt-2 text-sm text-[#68796E]">You're signed in as {membership?.role?.toLowerCase()}. Company settings and scheduling tools are being connected to your dashboard.</p>
          <div className="mt-6 flex flex-wrap gap-3"><Link href="/onboarding" className="inline-flex items-center gap-2 rounded-xl border border-[#DCE7DF] px-4 py-3 text-sm text-[#176343]"><Building2 size={17}/> Company setup</Link><Link href="/app/roster" className="inline-flex items-center gap-2 rounded-xl border border-[#DCE7DF] px-4 py-3 text-sm text-[#176343]"><CalendarDays size={17}/> Open roster calendar</Link><Link href="/app/availability" className="inline-flex items-center gap-2 rounded-xl border border-[#DCE7DF] px-4 py-3 text-sm text-[#176343]"><Clock3 size={17}/> My availability</Link></div>
        </div>
      </>}
    </div>
  </main>;
}
