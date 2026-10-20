"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Harvey II video block                                              */
/* ------------------------------------------------------------------ */

export function HarveyII() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.play();
    setIsPlaying(true);
  };

  return (
    <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24 text-center">
      <span className="inline-block text-[10px] tracking-wide rounded-full border border-black/20 px-3 py-1 mb-6">
        NEW
      </span>
      <h2 className="font-serif text-3xl sm:text-5xl mb-4">
        Introducing Shifti
      </h2>
      <p className="text-[#111110]/70 text-lg max-w-xl mx-auto mb-8">
        The most powerful Shift platform yet. Smarter agents can now deliver more
        complex work in exactly the way you like it.
      </p>
      <button className="rounded-md cursor-pointer bg-[#111110] px-6 py-3.5 text-[15px] text-white hover:bg-black transition-colors mb-12">
        Request a Demo
      </button>

      <div
        className="relative w-full rounded-xl overflow-hidden flex items-center justify-center"
        style={{
          height: "clamp(260px, 40vw, 460px)",
          background:
            "radial-gradient(circle at 50% 40%, #E9E6DD 0%, #D9D5C8 45%, #C7C2B2 100%)",
        }}
      >
        {/* Video sits above the gradient; gradient shows through until it loads */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          src="/videos/12925675_1920_1080_24fps.mp4"
          playsInline
          preload="metadata"
          onEnded={() => setIsPlaying(false)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Play button + gentle scrim, fades out once playing */}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/10 transition-opacity duration-500 ${
            isPlaying ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <button
            onClick={handlePlay}
            aria-label="Play video"
            className="relative flex items-center justify-center w-16 h-16 rounded-full bg-[#111110]/90 text-white hover:bg-black transition-colors"
          >
            <Play size={22} fill="white" />
          </button>
        </div>
      </div>
    </section>
  );
}