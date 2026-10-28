"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, Loader2, MapPin, Users } from "lucide-react";
import { authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getOnboardingStatus, registerCompany } from "@/lib/api/onboarding";

const TIMEZONES = [
  ["America/Winnipeg", "Central (Winnipeg)"],
  ["America/Toronto", "Eastern (Toronto)"],
  ["America/Vancouver", "Pacific (Vancouver)"],
  ["America/Edmonton", "Mountain (Edmonton)"],
  ["America/Halifax", "Atlantic (Halifax)"],
  ["America/St_Johns", "Newfoundland"],
  ["America/Chicago", "Central (US)"],
  ["America/New_York", "Eastern (US)"],
  ["Africa/Lagos", "West Africa (Lagos)"],
  ["Europe/London", "London"],
  ["UTC", "UTC"],
] as const;

export default function CompanyOnboardingPage() {
  const { user, isPending } = useCurrentUserState();
  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [firstLocation, setFirstLocation] = useState("");
  const [firstPosition, setFirstPosition] = useState("");
  const [timezone, setTimezone] = useState("America/Winnipeg");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [existingCompany, setExistingCompany] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isPending) return;
    if (!user || !authEnabled) {
      setChecking(false);
      return;
    }
    setOwnerName(user.displayName ?? "");
    setContactEmail(user.primaryEmail ?? "");
    let cancelled = false;
    void getOnboardingStatus().then((result) => {
      if (cancelled) return;
      if (result.ok && result.data.hasCompany) {
        setExistingCompany(result.data.organizationName ?? "Your organization");
      } else if (!result.ok) {
        setError(result.error);
      }
    }).catch(() => {
      if (!cancelled) setError("Could not verify your account. Try refreshing.");
    }).finally(() => {
      if (!cancelled) setChecking(false);
    });
    return () => { cancelled = true; };
  }, [user?.id, isPending, user?.displayName, user?.primaryEmail, user]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await registerCompany({
        companyName, ownerName, contactEmail, firstLocation, firstPosition, timezone,
      });
      if (!result.ok) {
        setError(result.error);
      } else {
        window.location.assign("/app");
      }
    } catch {
      setError("We couldn't create your company. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const fieldClass = "mt-2 w-full rounded-xl border border-[#D9E3DC] bg-white px-4 py-3.5 text-[15px] text-[#18241E] outline-none transition focus:border-[#2C7F5B] focus:ring-4 focus:ring-[#2C7F5B]/10";
  return (
    <main className="min-h-screen bg-[#F6F9F5] text-[#18241E]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7">
        <Link href="/" className="text-2xl font-semibold tracking-tight text-[#176343]">shiftii<span className="text-[#56B987]">.</span></Link>
        <span className="rounded-full bg-white px-4 py-2 text-xs font-medium text-[#5B6A60] shadow-sm">Company onboarding</span>
      </header>
      <div className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20 lg:pt-16">
        <section className="lg:pt-10">
          <span className="rounded-full bg-[#DBF2E5] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#176343]">Get started</span>
          <h1 className="mt-7 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Your team.<br/><span className="text-[#248357]">Beautifully organized.</span></h1>
          <p className="mt-6 max-w-md text-base leading-7 text-[#647368]">Set up your company in minutes. Create rosters, manage availability and build a better way for your team to work.</p>
          <div className="mt-12 grid gap-6">
            <div className="flex items-start gap-4"><span className="rounded-xl bg-white p-3 shadow-sm"><Building2 className="text-[#248357]" size={20}/></span><div><p className="font-semibold">Your own workspace</p><p className="mt-1 text-sm text-[#647368]">Private organization, locations and roles.</p></div></div>
            <div className="flex items-start gap-4"><span className="rounded-xl bg-white p-3 shadow-sm"><Users className="text-[#248357]" size={20}/></span><div><p className="font-semibold">Your team, your rules</p><p className="mt-1 text-sm text-[#647368]">You become the company owner and can build your team.</p></div></div>
            <div className="flex items-start gap-4"><span className="rounded-xl bg-white p-3 shadow-sm"><MapPin className="text-[#248357]" size={20}/></span><div><p className="font-semibold">Ready for the first roster</p><p className="mt-1 text-sm text-[#647368]">Start with a location and position, then add shifts.</p></div></div>
          </div>
        </section>
        <section className="rounded-3xl border border-[#E0E9E1] bg-white p-6 shadow-[0_25px_85px_rgba(20,61,39,0.07)] sm:p-10">
          {isPending || checking ? <div className="flex items-center gap-3 py-16 text-[#647368]"><Loader2 size={20} className="animate-spin"/> Checking your account...</div>
            : !user || !authEnabled ? <div className="py-12"><h2 className="text-2xl font-semibold">Sign in first</h2><p className="mt-3 text-[#647368]">You need a verified account session before creating a company.</p><Link className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#176343] px-6 py-3 text-white" href="/signup">Create your account <ArrowRight size={18}/></Link></div>
            : existingCompany ? <div className="py-12"><CheckCircle2 size={34} className="text-[#248357]"/><h2 className="mt-5 text-2xl font-semibold">You&apos;re all set</h2><p className="mt-3 text-[#647368]">{existingCompany} is already connected to your account.</p><Link className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#176343] px-6 py-3 text-white" href="/app">Go to workspace <ArrowRight size={18}/></Link></div>
            : <>
              <div className="mb-8"><p className="text-xs font-semibold uppercase tracking-widest text-[#248357]">Step 2 of 2</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Create your company</h2><p className="mt-2 text-sm text-[#647368]">Tell us a little about your team to get started.</p></div>
              <form onSubmit={submit} className="space-y-5">
                <div><label htmlFor="company" className="text-sm font-medium">Company name *</label><input id="company" required maxLength={120} minLength={2} autoComplete="organization" placeholder="e.g. North Star Care" value={companyName} onChange={(e)=>setCompanyName(e.target.value)} className={fieldClass}/></div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div><label htmlFor="owner" className="text-sm font-medium">Your full name *</label><input id="owner" required minLength={2} maxLength={120} autoComplete="name" value={ownerName} onChange={(e)=>setOwnerName(e.target.value)} className={fieldClass}/></div>
                  <div><label htmlFor="email" className="text-sm font-medium">Company email</label><input id="email" type="email" maxLength={200} autoComplete="email" value={contactEmail} onChange={(e)=>setContactEmail(e.target.value)} placeholder="hello@company.com" className={fieldClass}/></div>
                </div>
                <div><label htmlFor="timezone" className="text-sm font-medium">Company timezone *</label><select id="timezone" value={timezone} onChange={(e)=>setTimezone(e.target.value)} className={fieldClass}>{TIMEZONES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div><label htmlFor="location" className="text-sm font-medium">First location</label><input id="location" maxLength={100} placeholder="Main branch" value={firstLocation} onChange={(e)=>setFirstLocation(e.target.value)} className={fieldClass}/></div>
                  <div><label htmlFor="position" className="text-sm font-medium">First job role</label><input id="position" maxLength={100} placeholder="Team member" value={firstPosition} onChange={(e)=>setFirstPosition(e.target.value)} className={fieldClass}/></div>
                </div>
                {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
                <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#176343] px-5 py-4 text-sm font-semibold text-white transition hover:bg-[#10492F] disabled:opacity-60">{loading ? <><Loader2 size={18} className="animate-spin"/> Creating workspace...</> : <>Create my workspace <ArrowRight size={18}/></>}</button>
                <p className="text-center text-xs text-[#7B8A7E]">You&apos;ll be the owner. No payment information required.</p>
              </form>
            </>}
        </section>
      </div>
    </main>
  );
}
