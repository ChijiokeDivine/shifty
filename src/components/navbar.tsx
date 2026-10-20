"use client";

import { useState } from "react";
import { X, ChevronRight, ChevronDown } from "lucide-react";
import { MEGA_MENUS, MegaMenuPanel } from "./mega-menu";

const MEGA_MENU_KEYS = [ "Solutions", "Company"] as const;

function NavTrigger({
  label,
  active,
  onEnter,
}: {
  label: string;
  active: boolean;
  onEnter: () => void;
}) {
  return (
    <button
      onMouseEnter={onEnter}
      className={`flex items-center gap-1 text-[15px] pb-1 border-b transition-colors ${
        active
          ? "text-[#111110] font-medium border-[#111110]"
          : "text-[#111110]/90 border-transparent hover:text-[#111110]"
      }`}
    >
      {label}
      <ChevronDown
        size={15}
        strokeWidth={1.75}
        className={`mt-px transition-transform ${active ? "rotate-180" : ""}`}
      />
    </button>
  );
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  return (
    <header
      className={
        mobileOpen
          ? "fixed inset-0 z-50 flex h-[100dvh] flex-col bg-[#F6F4EF]"
          : "sticky top-0 z-40 bg-[#CCDBD6]/95 backdrop-blur"
      }
      onMouseLeave={() => setOpenMenu(null)}
    >
      <nav className="mx-auto flex w-full max-w-7xl flex-none items-center justify-between px-6 py-4 lg:px-10">
        <a href="#" className="font-serif text-[28px] leading-none tracking-tight">
          Shifti
        </a>

        <div className="hidden lg:flex items-center gap-8">
          {MEGA_MENU_KEYS.map((key) => (
            <NavTrigger
              key={key}
              label={key}
              active={openMenu === key}
              onEnter={() => setOpenMenu(key)}
            />
          ))}
         
          <a
            href="#"
            onMouseEnter={() => setOpenMenu(null)}
            className="text-[15px] text-[#111110]/90 hover:text-[#111110] transition-colors"
          >
            Security
          </a>
        </div>

        <div className="hidden lg:flex items-center gap-3">
          <button className="flex cursor-pointer items-center gap-1.5 rounded-md border border-black/70 px-4 py-2 text-sm">
            Login
            <ChevronRight size={14} strokeWidth={1.75} />
          </button>
          <button className="rounded-md cursor-pointer bg-[#111110] px-4 py-2 text-sm text-white hover:bg-black transition-colors">
            Request a Demo
          </button>
        </div>

        <button
          className="lg:hidden"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? (
            <X size={22} />
          ) : (
            <svg
              aria-hidden="true"
              width={24}
              height={24}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <path d="M2 7h20M2 17h20" />
            </svg>
          )}
        </button>
      </nav>

      {openMenu && <MegaMenuPanel data={MEGA_MENUS[openMenu]} />}

      {mobileOpen && (
        <div className="lg:hidden flex min-h-0 flex-1 flex-col gap-4 border-t border-black/10 bg-[#F6F4EF] px-6 py-4">
          {[ "Solutions", "Security", "Company"].map(
            (item) => (
              <a key={item} href="#" className="text-[15px]">
                {item}
              </a>
            )
          )}
          <div className="flex gap-3 pt-2">
            <button className="flex-1 rounded-md border border-black/70 px-4 py-2 text-sm">
              Login
            </button>
            <button className="flex-1 rounded-md bg-[#111110] px-4 py-2 text-sm text-white">
              Request a Demo
            </button>
          </div>
        </div>
      )}
    </header>
  );
}