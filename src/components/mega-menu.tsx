interface MegaMenuItem {
  title: string;
  desc: string;
}

interface ConnectionPair {
  left: string;
  right: string;
}

export interface MegaMenuData {
  columns: [MegaMenuItem[], MegaMenuItem[]];
  graphic: "connections" | "preview";
  connectionPairs?: ConnectionPair[];
  captionTitle: string;
  captionDesc: string;
}

export const MEGA_MENUS: Record<string, MegaMenuData> = {

  Solutions: {
    columns: [
      [
        {
          title: "Innovation",
          desc: "Scale expertise and impact to drive firmwide transformation.",
        },
        {
          title: "Litigation",
          desc: "Reduce manual effort, prioritize strategy, and drive stronger outcomes in litigation.",
        },
        {
          title: "Transactional",
          desc: "Accelerate due diligence, contract analysis, and review with precision and control.",
        },
      ],
      [
        {
          title: "In-House",
          desc: "Streamline work and shift focus to strategy and speed.",
        },
        {
          title: "Law Firms",
          desc: "Deliver your firm's best work on every matter, with more time for clients.",
        },
        {
          title: "Mid-Sized Firms",
          desc: "Drive outsize impact with tools built for lean teams.",
        },
      ],
    ],
    graphic: "connections",
    connectionPairs: [
      { left: "Gleiss Lutz", right: "T" },
      { left: "PwC", right: "IFS" },
  
    ],
    captionTitle: "A New Era of Collaboration for Hospital Services",
    captionDesc:
      "Law firms and professional service networks have been using Shifti to build new service models and add value collaboratively.",
  },

  Company: {
    columns: [
      [
        {
          title: "About",
          desc: "Our mission to help legal teams own their intelligence.",
        },
        {
          title: "Careers",
          desc: "Join the team building the future of legal AI.",
        },
        {
          title: "Newsroom",
          desc: "The latest announcements and press coverage.",
        },
      ],
      [
        {
          title: "Trust & Security",
          desc: "How we protect your most sensitive data.",
        },
        {
          title: "Partners",
          desc: "Work with us to bring Shifti to your clients.",
        },
        {
          title: "Contact",
          desc: "Get in touch with our team.",
        },
      ],
    ],
    graphic: "preview",
    captionTitle: "Built by Legal and AI Experts",
    captionDesc:
      "Our team combines decades of legal practice with frontier AI research.",
  },
};

function ConnectionGraphic({ pairs }: { pairs: ConnectionPair[] }) {
  return (
    <div className="rounded-md bg-[#EDEAE2] p-6 flex flex-col gap-6">
      {pairs.map((p) => (
        <div key={p.left} className="flex items-center gap-3">
          <span className="text-xs text-[#111110]/70 w-32 shrink-0 truncate">
            {p.left}
          </span>
          <span className="flex-1 h-px bg-black/15" />
          <span className="w-7 h-7 rounded-full bg-white border border-black/10 flex items-center justify-center text-[10px] text-[#111110]/60 shrink-0">
            {p.right}
          </span>
        </div>
      ))}
    </div>
  );
}

function PreviewGraphic() {
  return (
    <div className="rounded-md bg-[#EDEAE2] p-6 h-40 flex flex-col justify-center gap-2.5">
      <div className="h-2.5 w-2/3 rounded bg-black/10" />
      <div className="h-2.5 w-1/2 rounded bg-black/10" />
      <div className="h-2.5 w-5/6 rounded bg-black/10" />
      <div className="h-2.5 w-1/3 rounded bg-black/10" />
    </div>
  );
}

export function MegaMenuPanel({ data }: { data: MegaMenuData }) {
  return (
    <div className="absolute inset-x-0 top-full bg-[#CCDBD6] border-t border-black/10 shadow-xl z-50">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-10 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8">
          {data.columns.map((col, i) => (
            <div key={i} className="flex flex-col gap-7">
              {col.map((item) => (
                <div key={item.title}>
                  <p className="text-[15px] font-medium mb-1">{item.title}</p>
                  <p className="text-sm text-[#111110]/60 leading-snug max-w-[240px]">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          {data.graphic === "connections" ? (
            <ConnectionGraphic pairs={data.connectionPairs ?? []} />
          ) : (
            <PreviewGraphic />
          )}
          <div>
            <p className="text-[15px] font-medium mb-1">{data.captionTitle}</p>
            <p className="text-sm text-[#111110]/60 leading-snug">
              {data.captionDesc}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}