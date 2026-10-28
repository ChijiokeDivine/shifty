"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2, MailCheck } from "lucide-react";
import { authClient, authEnabled } from "@/lib/auth/client";
import { emailDeliveryStatus } from "@/lib/api/auth-status";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [ready, setReady] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void emailDeliveryStatus().then((result) => setReady(result.configured))
      .catch(() => setReady(false));
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    setError("");
    setSending(true);
    try {
      const { error: requestError } = await authClient.requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: "/reset-password",
      });
      if (requestError) {
        setError("Unable to process this request. Please try again.");
      } else {
        // Uniform response avoids disclosing whether an account exists.
        setSent(true);
      }
    } catch {
      setError("Unable to process this request. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const field = "mt-2 w-full rounded-xl border border-[#D8E5DB] bg-white px-4 py-3.5 text-[#18241E] outline-none focus:border-[#248357] focus:ring-4 focus:ring-[#248357]/10";
  return <main className="grid min-h-screen place-items-center bg-[#F5F9F5] px-6 py-12 text-[#18241E]">
    <div className="w-full max-w-md">
      <Link href="/" className="text-2xl font-semibold text-[#176343]">shiftii<span className="text-[#58B785]">.</span></Link>
      <div className="mt-9 rounded-3xl border border-[#E2EBE3] bg-white p-8 shadow-[0_25px_85px_rgba(20,61,39,0.07)]">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#248357]"><MailCheck size={17}/> Account recovery</span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Forgot your password?</h1>
        {sent ? <>
          <p role="status" className="mt-5 leading-7 text-[#647368]">If an account exists for that address, you'll receive a password reset link. Check your inbox and spam folder.</p>
          <Link href="/login" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#176343] px-5 py-3.5 font-semibold text-white">Back to login <ArrowRight size={18}/></Link>
        </> : <>
          <p className="mt-4 text-[#647368]">Enter your account email. We'll send a secure reset link if the address is registered.</p>
          <form className="mt-7 space-y-5" onSubmit={submit}>
            <div><label htmlFor="email" className="text-sm font-medium">Email address</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} className={field} placeholder="you@company.com"/></div>
            {ready === false && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Password recovery isn't configured yet. Please contact the Shiftii administrator.</p>}
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            <button disabled={!authEnabled || !ready || sending} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#176343] px-5 py-3.5 font-semibold text-white disabled:opacity-60">{sending ? <Loader2 size={18} className="animate-spin"/> : <MailCheck size={18}/>} Send reset link</button>
          </form>
        </>}
      </div>
      <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm text-[#176343]"><ArrowLeft size={17}/> Return to sign in</Link>
    </div>
  </main>;
}
