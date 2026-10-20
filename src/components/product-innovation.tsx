"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  Users,
  Bell,
  Activity,
  Repeat,
  Stethoscope,
  HeartPulse,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Find Your Fit — hospital shift management                         */
/* ------------------------------------------------------------------ */

type FitItem = {
  icon: LucideIcon;
  title: string;
  desc: string;
  bgImage: string;
};

const TABS = ["Use Cases", "Roles"] as const;
type Tab = (typeof TABS)[number];

const CONTENT: Record<Tab, FitItem[]> = {
  "Use Cases": [
    {
      icon: Clock,
      title: "Shift Scheduling",
      desc: "Build and publish schedules across every unit in minutes, not hours.",
      bgImage: "/videos/6176553-hd_1366_720_30fps.mp4",
    },
    {
      icon: Repeat,
      title: "Open Shifts & Swaps",
      desc: "Let staff pick up or trade shifts within your approval rules.",
      bgImage: "/videos/5998385-hd_1280_720_30fps.mp4",
    },
    {
      icon: HeartPulse,
      title: "ICU & Critical Care",
      desc: "Guarantee minimum coverage for your highest-acuity units.",
      bgImage: "/videos/3197622-hd_1920_1080_25fps.mp4",
    },
    // {
    //   icon: Bell,
    //   title: "Coverage Alerts",
    //   desc: "Get notified the moment a shift risks going unfilled.",
    //   bgImage: "/assets/img/8d9fbf7e5e26e9a7.webp",
    // },
    {
      icon: Activity,
      title: "Real-Time Staffing Ratios",
      desc: "See nurse-to-patient ratios live, unit by unit.",
      bgImage: "/videos/6130024-hd_1280_720_30fps.mp4",
    },
  ],
  Roles: [
    {
      icon: Stethoscope,
      title: "Nursing",
      desc: "Self-scheduling, acuity-based staffing, and shift bidding.",
      bgImage: "/assets/img/fit/nursing.webp",
    },
    {
      icon: HeartPulse,
      title: "ICU & Critical Care",
      desc: "Guarantee minimum coverage for your highest-acuity units.",
      bgImage: "/videos/3197622-hd_1920_1080_25fps.mp4",
    },
    {
      icon: ClipboardList,
      title: "Charge & Admin",
      desc: "Approve time-off, swaps, and overtime from a single queue.",
      bgImage: "/assets/img/fit/charge-admin.webp",
    },
    {
      icon: Users,
      title: "Physicians & APPs",
      desc: "Manage on-call rotations and cross-department coverage.",
      bgImage: "/assets/img/fit/physicians.webp",
    },
  ],
};

// Extensions treated as video; anything else falls back to <img>
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov", ".m4v"];

function isVideoSrc(src: string) {
  const clean = src.split("?")[0].toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => clean.endsWith(ext));
}

function FitCard({ icon: Icon, title, desc, bgImage }: FitItem) {
  const isVideo = isVideoSrc(bgImage);

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-black/10 p-6 h-[390px] transition-transform duration-300 hover:-translate-y-1">
      {/* Background media — video or image, same slot */}
      {isVideo ? (
        <video
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          src={bgImage}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      ) : (
        <img
          src={bgImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      )}
      {/* Darkening scrim so white text/icon stay legible over any media */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />

      {/* Content above the media */}
      <div className="relative z-10 w-14 h-14 flex items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
        <Icon size={28} strokeWidth={1.5} className="text-white" />
      </div>
      <div className="relative z-10">
        <p className="text-lg font-medium mb-1 text-white">{title}</p>
        <p className="text-[13px] text-white/75 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

export function FindYourFit() {
  const [activeTab, setActiveTab] = useState<Tab>("Use Cases");
  const [visible, setVisible] = useState(true);

  // Cross-fade the grid whenever the tab changes
  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 40);
    return () => clearTimeout(t);
  }, [activeTab]);

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 50% 15%, #6B84B4 0%, #5B72A0 55%, #4E6390 100%)",
      }}
    >
      <div className="mx-auto max-w-7xl px-6 pt-20 lg:px-10 lg:pt-28 text-center">
        <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-white mb-6 leading-[1.1]">
          Built for every unit
          <br />
          and every shift
        </h2>
        <p className="text-white/80 text-lg max-w-2xl mx-auto mb-10">
          Whether you&apos;re covering the ICU, filling a last-minute
          call-out, or planning next month&apos;s schedule, your scheduling
          platform fits the way your hospital runs.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-14">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-5 py-2 text-xs font-medium transition-colors duration-200 ${
                activeTab === tab
                  ? "bg-[#111110] text-white"
                  : "bg-white text-[#111110] hover:bg-white/90"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-20 lg:px-10 lg:pb-28">
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5 transition-opacity duration-300 ${
            visible ? "opacity-100" : "opacity-0"
          }`}
        >
          {CONTENT[activeTab].map((item) => (
            <FitCard key={item.title} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}