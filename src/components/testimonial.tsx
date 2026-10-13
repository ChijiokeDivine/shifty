export function Testimonial() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.6fr] gap-10 items-center bg-[#EDEAE2] rounded-xl overflow-hidden">
        <div className="h-72 md:h-full bg-[#D9D5C8] flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-[#111110]/15 flex items-center justify-center text-[#111110]/40 text-sm">
            Photo
          </div>
        </div>
        <div className="p-8 md:p-12 flex flex-col gap-6">
          <p className="font-serif text-2xl sm:text-3xl leading-snug">
            &ldquo;What we have seen at Reed Smith with Shifti is by far the
            most successful firm technology adoption story I have ever been a
            part of.&rdquo;
          </p>
          <div className="text-sm">
            <p className="font-medium">Rich Robbins</p>
            <p className="text-[#111110]/60">
              Director of Applied Artificial Intelligence
            </p>
            <p className="font-serif text-lg mt-2">Reed Smith</p>
          </div>
        </div>
      </div>
    </section>
  );
}