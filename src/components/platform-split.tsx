"use client";

import { useState } from "react";

function PlatformCard({
  title,
  copy,
  cta,
  bgImage,
  screenshotImage,
}: {
  title: string;
  copy: string;
  cta: string;
  bgImage: string;
  screenshotImage: string;
}) {
  return (
    <div className="relative flex flex-col rounded-2xl overflow-hidden border border-black/10 h-[480px] sm:h-[540px] w-full">
      <img
        src={bgImage}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/25" />

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex flex-col gap-3 p-7 sm:p-9 md:mb-4">
          <h3 className="font-serif text-2xl sm:text-3xl text-white">{title}</h3>
          <p className="text-[15px] text-white/85 leading-relaxed max-w-sm">
            {copy}
          </p>
          <a
            href="#"
            className="mt-2 inline-flex items-center justify-center w-fit rounded-lg border border-white/70 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white hover:text-black"
          >
            {cta}
          </a>
        </div>

        <div className="relative flex-1 -mt-4 px-5 sm:px-7">
          <div className="h-full rounded-t-lg overflow-hidden border border-black/10 shadow-xl bg-white">
            <img
              src={screenshotImage}
              alt={`${title} product screenshot`}
              className="w-full h-full object-cover object-top"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PlatformVideoCard({ videoSrc }: { videoSrc: string }) {
  return (
    <div className="relative rounded-2xl overflow-hidden h-[480px] sm:h-[540px] w-full">
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src={videoSrc}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
    </div>
  );
}

export function PlatformSplit() {
  const [hovered, setHovered] = useState<number | null>(null);

  const basisFor = (index: number) => {
    if (hovered === null) return "50%";
    return hovered === index ? "65%" : "35%";
  };

  return (
    <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h2 className="font-serif text-4xl sm:text-5xl mb-4">
          One Platform for Medical Work
        </h2>
        <p className="text-[#111110]/70 text-lg">
          Hospitals and health systems do their best work with Shifti. Run
          everything your team and health system needs on one collaborative
          platform.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div
          className="min-w-0 transition-[flex-basis] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[flex-basis]"
          style={{ flexBasis: basisFor(0) }}
          onMouseEnter={() => setHovered(0)}
          onMouseLeave={() => setHovered(null)}
        >
          <PlatformCard
            title="For Hospitals & Health Systems"
            copy="Run every client matter securely on one platform, with your nurses and staff working from the same context."
            cta="Explore Shifti"
            bgImage="/assets/img/4d82ceec018ada91.webp"
            screenshotImage="/image.webp"
          />
        </div>

        <div
          className="min-w-0 transition-[flex-basis] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[flex-basis]"
          style={{ flexBasis: basisFor(1) }}
          onMouseEnter={() => setHovered(1)}
          onMouseLeave={() => setHovered(null)}
        >
          <PlatformVideoCard videoSrc="videos/12925500_1920_1080_30fps.mp4" />
        </div>
      </div>
    </section>
  );
}