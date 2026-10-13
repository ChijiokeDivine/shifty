
/* ------------------------------------------------------------------ */
/*  Footer                                                             */
/* ------------------------------------------------------------------ */

export function Footer() {
  const columns = [
    {
      title: "Platform",
      links: ["Agents", "Spaces", "Vault", "Contract Intelligence", "Command Center"],
    },
    {
      title: "Solutions",
      links: ["For Law Firms", "For In-House Teams"],
    },
    {
      title: "Company",
      links: ["About", "Careers", "Newsroom"],
    },

  ];

  return (
    <footer className="border-t border-black/10">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-10 grid grid-cols-2 sm:grid-cols-4 gap-10">
        {columns.map((col) => (
          <div key={col.title} className="flex flex-col gap-3">
            <p className="text-sm font-medium text-[#111110]/50">{col.title}</p>
            {col.links.map((l) => (
              <a key={l} href="#" className="text-sm text-[#111110]/80 hover:text-[#111110]">
                {l}
              </a>
            ))}
          </div>
        ))}
      </div>
      <div className="mx-auto max-w-7xl px-6 py-6 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-black/10">
        <span className="font-serif text-xl">Shifti</span>
        <p className="text-xs text-[#111110]/50">
          © {new Date().getFullYear()} Shifti. All rights reserved.
        </p>
      </div>
    </footer>
  );
}