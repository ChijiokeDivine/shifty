"use client";

import { useState } from "react";
import { X } from "lucide-react";

export function AnnouncementBanner() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className="relative bg-[#111110] text-white text-[13px] sm:text-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-10 py-3 text-center">
        <span className="font-sans">
         Shifti Now Powers Scheduling for 500+ Hospitals Nationwide
        </span>
        <a href="#" className="font-sans font-semibold underline underline-offset-2 shrink-0">
          Learn more
        </a>
      </div>
      <button
        aria-label="Dismiss announcement"
        onClick={() => setVisible(false)}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white transition-colors"
      >
        <X size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}