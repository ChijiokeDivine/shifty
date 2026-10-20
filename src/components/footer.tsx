/* ------------------------------------------------------------------ */
/*  Footer                                                             */
/* ------------------------------------------------------------------ */

export function Footer() {
  const columns = [
    {
      title: "Platform",
      links: [
        "Care Coordination",
        "Patient Pathways",
        "Clinical Intelligence",
        "Shift Management",
        "Secure Messaging",
        "Analytics",
        "Integrations",
      ],
    },
    {
      title: "Solutions",
      links: [
        "Hospitals",
        "Clinics",
        "Home Care",
        "Nursing Teams",
        "Care Managers",
        "Health Systems",

      ],
    },
    {
      title: "Resources",
      links: [
        "Blog",
        "Case Studies",
        "Documentation",
        "Webinars",
        "Help Center",
        "API Reference",
   
      ],
    },
    {
      title: "Company",
      links: [
        "About",
        "Careers",
        "Customers",
        "Press",
        "Partners",
        "Security",
        "Contact",
      ],
    },
  ];

  return (
    <footer className="bg-white py-16 px-4 sm:px-6">
      {/* Main card */}
      <div className="mx-auto max-w-6xl rounded-2xl bg-white px-8 py-12 ">
        {/* Link columns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-10 lg:gap-8">
          {columns.map((col) => (
            <div key={col.title} className="flex flex-col gap-3.5">
              <p className="text-[13px] font-medium text-[#111110]/45 tracking-wide">
                {col.title}
              </p>
              {col.links.map((link) => (
                <a
                  key={link}
                  href="#"
                  className="text-[14px] text-[#111110]/80 hover:text-[#111110] transition-colors"
                >
                  {link}
                </a>
              ))}
            </div>
          ))}

          {/* Follow Us column */}
          <div className="flex flex-col gap-3.5">
            <p className="text-[13px] font-medium text-[#111110]/45 tracking-wide">
              Follow Us
            </p>
            <div className="flex items-center gap-3 mt-1">
              {/* X / Twitter */}
              <a
                href="#"
                className="text-[#111110]/70 hover:text-[#111110] transition-colors"
                aria-label="X"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              {/* Instagram */}
              <a
                href="#"
                className="text-[#111110]/70 hover:text-[#111110] transition-colors"
                aria-label="Instagram"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
                </svg>
              </a>
              {/* LinkedIn */}
              <a
                href="#"
                className="text-[#111110]/70 hover:text-[#111110] transition-colors"
                aria-label="LinkedIn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>

            {/* Contact block (optional – mirrors the image) */}
            <div className="mt-8 space-y-1">
              <p className="text-[13px] text-[#111110]/45">Contact Sales</p>
              <a
                href="tel:+14158945886"
                className="text-[14px] text-[#111110]/80 hover:text-[#111110]"
              >
                (415) 894-5886
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center">
            <span className="font-serif text-3xl tracking-tight text-[#111110]">
              Shifti
            </span>
          </div>

          {/* Copyright + legal */}
          <div className="flex flex-col items-start sm:items-end gap-2 text-right">
            <p className="text-[13px] text-[#111110]/50">
              Shifti © {new Date().getFullYear()}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-[#111110]/50">
              <a href="#" className="hover:text-[#111110] transition-colors">
                Terms
              </a>
              <span>·</span>
              <a href="#" className="hover:text-[#111110] transition-colors">
                Privacy
              </a>
              <span>·</span>
              <a href="#" className="hover:text-[#111110] transition-colors">
                HIPAA
              </a>
              <span>·</span>
              <a href="#" className="hover:text-[#111110] transition-colors">
                Trust
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}