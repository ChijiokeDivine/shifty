import { Play } from "lucide-react";

function VideoCard({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="relative h-52 sm:h-64 rounded-lg overflow-hidden bg-gradient-to-br from-[#2A2A28] to-[#57544A] flex items-center justify-center">
        <button
          aria-label="Play video"
          className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
        >
          <Play size={16} className="text-[#111110]" fill="#111110" />
        </button>
      </div>
      <p className="font-serif text-xl text-white leading-snug">{title}</p>
    </div>
  );
}

export function RealImpact() {
  return (
    <section className="bg-[#0B0B0A] text-white">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
        <div className="flex items-center justify-between mb-10">
          <h2 className="font-serif text-3xl sm:text-4xl">
            Real Impact for Real Clients
          </h2>
        <a
            href="#"
            className="hidden sm:inline-block text-sm rounded-md border border-white/25 px-4 py-2 hover:bg-white/10 transition-colors"
          >
            See More Videos
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-14">
          <VideoCard title="A New Era of Collaboration for Legal and Professional Services" />
          <VideoCard title="CMS on Bringing Legal Work to the Next Frontier" />
        </div>

      

       
      </div>
    </section>
  );
}