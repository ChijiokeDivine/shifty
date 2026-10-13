export function LogoCloud() {
  const logos = [
    "Fenwick",
    "Sidley Austin",
    "KKR",
    "O'Melveny",
    "Booking.com",
    "Gleiss Lutz",

  ];

  return (
    <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
      <p className="text-center text-sm text-[#111110]/60 mb-10">
        2,400+ Legal Organizations Build on Shifti
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-10">
        {logos.map((name) => (
          <div
            key={name}
            className="flex items-center justify-center font-serif text-lg sm:text-xl text-[#111110]/40 text-center"
          >
            {name}
          </div>
        ))}
      </div>
    </section>
  );
}