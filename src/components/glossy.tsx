export function GlossyMark() {
  // Decorative 3D "bubble cluster" mark, standing in for a brand icon
  const bubbles = [
    { size: 64, from: "#BFE3F0", to: "#3E8FAE" },
    { size: 72, from: "#A9DCEE", to: "#2E7A9A" },
    { size: 64, from: "#BFE3F0", to: "#3E8FAE" },
  ];
  return (
    <span className="inline-flex items-center -space-x-3 align-middle mr-3">
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="rounded-full shadow-[inset_-6px_-6px_10px_rgba(0,0,0,0.25),inset_4px_4px_8px_rgba(255,255,255,0.6)]"
          style={{
            width: b.size,
            height: b.size,
            background: `radial-gradient(circle at 30% 28%, ${b.from} 0%, ${b.to} 70%)`,
          }}
        />
      ))}
    </span>
  );
}