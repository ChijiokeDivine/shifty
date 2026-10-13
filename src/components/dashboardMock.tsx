"use client";

import { useEffect, useRef, useState } from "react";

type ConnectionQuality = "lite" | "full";

interface NetworkInformation extends EventTarget {
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  saveData?: boolean;
  downlink?: number;
  addEventListener: (type: "change", listener: () => void) => void;
  removeEventListener: (type: "change", listener: () => void) => void;
}

declare global {
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
}

const MOBILE_SRC = "videos/7584841-hd_2048_1080_25fps.mp4"; // ~3MB
const DESKTOP_SRC = "videos/7584841-uhd_2732_1440_25fps.mp4"; // ~13MB

const DESKTOP_BREAKPOINT = "(min-width: 768px)"; // adjust to taste
const SLOW_DOWNLINK_THRESHOLD = 4; // Mbps — below this, treat as "lite"

function getConnectionQuality(): ConnectionQuality {
  if (typeof navigator === "undefined") return "full";

  const conn =
    navigator.connection ?? navigator.mozConnection ?? navigator.webkitConnection;

  // API unsupported (Safari/iOS) — assume a decent connection rather than guess
  if (!conn) return "full";

  if (conn.saveData) return "lite";
  if (conn.effectiveType && ["slow-2g", "2g", "3g"].includes(conn.effectiveType)) {
    return "lite";
  }
  if (typeof conn.downlink === "number" && conn.downlink < SLOW_DOWNLINK_THRESHOLD) {
    return "lite";
  }

  return "full";
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_BREAKPOINT);
    setIsDesktop(mql.matches);

    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isDesktop;
}

function useConnectionQuality() {
  const [quality, setQuality] = useState<ConnectionQuality>("full");

  useEffect(() => {
    setQuality(getConnectionQuality());

    const conn = navigator.connection ?? navigator.mozConnection ?? navigator.webkitConnection;
    if (!conn) return;

    const handler = () => setQuality(getConnectionQuality());
    conn.addEventListener("change", handler);
    return () => conn.removeEventListener("change", handler);
  }, []);

  return quality;
}

// Fires once, either immediately (if the node is already in the viewport
// on mount — covers the "page loads" case) or on first scroll-into-view.
function useRevealOnView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setIsRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, isRevealed };
}

export function DashboardVideo({
  mobileSrc = MOBILE_SRC,
  desktopSrc = DESKTOP_SRC,
}: {
  mobileSrc?: string;
  desktopSrc?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const isDesktop = useIsDesktop();
  const quality = useConnectionQuality();
  const { ref, isRevealed } = useRevealOnView<HTMLDivElement>();

  useEffect(() => setMounted(true), []);

  // Default to the lite video until we know better — avoids an SSR
  // hydration mismatch and avoids guessing wrong on a slow connection.
  const src = mounted && isDesktop && quality === "full" ? desktopSrc : mobileSrc;

  return (
    <div
      ref={ref}
      className="relative w-full aspect-[16/10] sm:aspect-[21/9] rounded-4xl overflow-hidden"
      style={{
        background:
          "linear-gradient(115deg, #3B4A47 0%, #4E6560 30%, #8FA39C 55%, #C9D2C9 75%, #3B4A47 100%)",
        clipPath: isRevealed
          ? "circle(75% at 50% 50%)"
          : "circle(42% at 50% 50%)",
        transform: isRevealed ? "scale(1)" : "scale(0.96)",
        opacity: isRevealed ? 1 : 0,
        transition:
          "clip-path 1.3s cubic-bezier(0.16, 1, 0.3, 1), transform 1.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.9s ease-out",
        willChange: "clip-path, transform, opacity",
      }}
    >
      <video
        key={src}
        className="absolute inset-0 w-full h-full object-cover"
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
    </div>
  );
}