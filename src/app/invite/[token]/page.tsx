"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { acceptInvitation, previewInvitation } from "@/lib/api/invitations";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { user, isPending } = useCurrentUserState();
  const [invitation, setInvitation] = useState<{ organizationName: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!token) { setError("Missing invitation token."); setLoading(false); return; }
    void previewInvitation(token).then((result) => {
      if (!active) return;
      if (!result.ok) setError(result.error);
      else setInvitation(result.data);
    }).catch(() => { if (active) setError("Couldn't load this invitation."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  async function accept() {
    setBusy(true); setError("");
    try {
      const result = await acceptInvitation(token);
      if (!result.ok) setError(result.error);
      else setAccepted(true);
    } catch { setError("Unable to accept the invitation. Please retry."); }
    finally { setBusy(false); }
  }

  // Encode the full invitation URL as the return destination; no external
  // redirects are accepted.
  const next = `/invite/${token}`;
  return <main className="grid min-h-screen place-items-center bg-[#F5F9F5] px-5 py-10 text-[#18251E]">
    <div className="w-full max-w-lg">
      <Link href="/" className="text-2xl font-semibold text-[#176343]">shiftii<span className="text-[#58B785]">.</span></Link>
      <div className="mt-9 rounded-3xl border border-[#E0E9E1] bg-white p-8 shadow-[0_25px_85px_rgba(20,61,39,0.07)] sm:p-11">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#EAF7EF] px-3 py-2 text-xs font-semibold text-[#176343]"><ShieldCheck size={15}/> Secure invitation</span>
        {loading || isPending ? <p className="mt-8 flex items-center gap-3 text-[#687A6D]"><Loader2 className="animate-spin" size={20}/> Checking invitation...</p>
        : accepted ? <><CheckCircle2 size={38} className="mt-8 text-[#248357]"/><h1 className="mt-4 text-3xl font-semibold">You're on the team!</h1><p className="mt-3 text-[#687A6D]">Your company membership is active.</p><Link href="/app" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#176343] px-5 py-3.5 font-semibold text-white">Open workspace <ArrowRight size={18}/></Link></>
        : invitation ? <><Building2 size={31} className="mt-8 text-[#248357]"/><h1 className="mt-4 text-3xl font-semibold tracking-tight">You're invited to join {invitation.organizationName}.</h1><p className="mt-4 text-[#687A6D]">Join as a <strong>{invitation.role.toLowerCase()}</strong>. Your company will manage your scheduling and availability in Shiftii.</p>
          {!user ? <div className="mt-8 flex flex-col gap-3"><Link href={`/signup?invite=${encodeURIComponent(token)}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#176343] px-5 py-3.5 font-semibold text-white">Create your account <ArrowRight size={18}/></Link><Link href={`/login?invite=${encodeURIComponent(token)}`} className="rounded-xl border border-[#DCE6DE] px-5 py-3.5 text-center font-medium text-[#176343]">Sign in to accept</Link></div>
          : <div className="mt-8"><p className="mb-4 text-sm text-[#647368]">Signed in as <strong>{user.primaryEmail}</strong>. Your verified account email must match the invitation.</p><button type="button" onClick={()=>{void accept();}} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#176343] px-5 py-3.5 font-semibold text-white disabled:opacity-60">{busy ? <Loader2 size={18} className="animate-spin"/> : <ArrowRight size={18}/>} Accept invitation</button></div>}
        </> : <><h1 className="mt-7 text-2xl font-semibold">Invitation unavailable</h1><p className="mt-3 text-[#687A6D]">This link may have expired or been revoked. Ask your manager for a new one.</p></>}
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      </div>
    </div>
  </main>;
}
