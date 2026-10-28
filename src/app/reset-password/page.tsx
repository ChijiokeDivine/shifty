"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth/client";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const token = params.get("token");
  const invalid = params.get("error");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setError("");
    if (password.length < 8 || password.length > 128) {
      setError("Use a password between 8 and 128 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) setError("This link has expired or is invalid. Request a new one.");
      else setComplete(true);
    } catch {
      setError("Could not reset your password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-2 w-full rounded-xl border border-[#D8E5DB] bg-white px-4 py-3 text-[#18241E] outline-none focus:border-[#248357] focus:ring-4 focus:ring-[#248357]/10";
  return <main className="grid min-h-screen place-items-center bg-[#F5F9F5] px-6 py-12 text-[#18241E]"><div className="w-full max-w-md">
    <Link href="/" className="text-2xl font-semibold text-[#176343]">shiftii<span className="text-[#58B785]">.</span></Link>
    <section className="mt-9 rounded-3xl border border-[#E2EBE3] bg-white p-8 shadow-[0_25px_85px_rgba(20,61,39,0.07)]">
      {complete ? <><CheckCircle2 size={34} className="text-[#248357]"/><h1 className="mt-5 text-3xl font-semibold">Password updated.</h1><p className="mt-3 text-[#647368]">Your password was changed. Sign in using the new password.</p><Link href="/login" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#176343] px-5 py-3.5 font-semibold text-white">Sign in <ArrowRight size={18}/></Link></>
      : <><KeyRound size={29} className="text-[#248357]"/><h1 className="mt-5 text-3xl font-semibold">Create a new password.</h1>
      {!token || invalid ? <><p role="alert" className="mt-4 text-[#647368]">The reset link is invalid or expired.</p><Link href="/forgot-password" className="mt-6 inline-flex items-center gap-2 text-[#176343]">Request a new link <ArrowRight size={18}/></Link></>
      : <form onSubmit={submit} className="mt-7 space-y-5">
        <div><label htmlFor="password" className="text-sm font-medium">New password</label><input id="password" required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className={field}/></div>
        <div><label htmlFor="confirm" className="text-sm font-medium">Confirm password</label><input id="confirm" required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} className={field}/></div>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <button disabled={busy} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#176343] px-5 py-3.5 font-semibold text-white disabled:opacity-60">{busy ? <Loader2 size={18} className="animate-spin"/> : <KeyRound size={18}/>} Reset password</button>
      </form>}</>}
    </section>
  </div></main>;
}
