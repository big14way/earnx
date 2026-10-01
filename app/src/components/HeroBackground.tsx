/**
 * Layered hero backdrop: deep green base, slowly drifting aurora light, a fading grid and film grain.
 * Pure CSS, so it costs nothing on the main thread and stops under prefers-reduced-motion.
 */
export function HeroBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_70%_10%,#1d4a33_0%,#10231a_45%,#0a160f_100%)]" />
      <div className="aurora aurora-1" />
      <div className="aurora aurora-2" />
      <div className="aurora aurora-3" />
      <div className="hero-grid absolute inset-0" />
      <div className="grain absolute inset-0" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[#0a160f]" />
    </div>
  );
}
