"use client";

import { useState } from "react";
import { X, ChevronRight, ChevronDown, Menu } from "lucide-react";
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
      className="sticky top-0 z-40 bg-[#CCDBD6]/95 backdrop-blur "
      onMouseLeave={() => setOpenMenu(null)}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
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
          <button className="flex items-center gap-1.5 rounded-md border border-black/70 px-4 py-2 text-sm">
            Login
            <ChevronRight size={14} strokeWidth={1.75} />
          </button>
          <button className="rounded-md bg-[#111110] px-4 py-2 text-sm text-white hover:bg-black transition-colors">
            Request a Demo
          </button>
        </div>

        <button
          className="lg:hidden"
          aria-label="Toggle menu"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {openMenu && <MegaMenuPanel data={MEGA_MENUS[openMenu]} />}

      {mobileOpen && (
        <div className="lg:hidden border-t border-black/10 bg-[#F6F4EF] px-6 py-4 flex flex-col gap-4">
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