export function Hero() {
  return (
    <section className="mx-auto max-w-7xl px-6 pt-16 pb-14 lg:px-10 lg:pt-24 lg:pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-10 items-start">
        <h1 className="font-serif font-normal text-[15vw] sm:text-7xl lg:text-[86px] leading-[0.98] tracking-tight">
          A better way to 
          <br />
          run healthcare
        </h1>
        <div className="flex flex-col gap-6 lg:pt-3">
          <p className="text-lg lg:text-xl leading-snug text-[#111110]/90 max-w-md">
            Shiftii streamlines hospital operations for smarter teams and better care.
          </p>
          <button className="w-fit rounded-md bg-[#111110] px-6 py-3.5 text-[15px] text-white hover:bg-black transition-colors">
            Request a Demo
          </button>
        </div>
      </div>
    </section>
  );
}