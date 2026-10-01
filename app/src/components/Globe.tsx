import { useEffect, useRef } from 'react';
import createGlobe from 'cobe';
import { useReducedMotion } from 'motion/react';
import type { Invoice } from '../lib/invoice';
import { placeOf } from '../lib/geo';

const LIME: [number, number, number] = [0.78, 0.95, 0.41];
const GOLD: [number, number, number] = [0.96, 0.74, 0.29];

/**
 * A rotating globe whose arcs are the live invoices: each one runs from the exporter's country to
 * the buyer's. Funded and repaid routes glow lime; routes still raising money glow gold.
 */
export function Globe({ invoices, className = '' }: { invoices: Invoice[]; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();
  const routeKey = invoices.map((i) => `${i.origin}>${i.destination}:${i.status}`).join('|');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const routes = invoices
      .map((inv) => ({ inv, from: placeOf(inv.origin), to: placeOf(inv.destination) }))
      .filter((r): r is { inv: Invoice; from: [number, number]; to: [number, number] } => Boolean(r.from && r.to));
    const settled = (s: Invoice['status']) => s === 'Funded' || s === 'Repaid';
    const markers = new Map<string, { location: [number, number]; size: number; color: [number, number, number] }>();
    for (const r of routes) {
      markers.set(r.from.join(), { location: r.from, size: 0.07, color: LIME });
      if (!markers.has(r.to.join())) markers.set(r.to.join(), { location: r.to, size: 0.045, color: GOLD });
    }

    let width = canvas.offsetWidth;
    let phi = -0.35; // start with Africa facing the viewer
    let velocity = 0;
    let dragX: number | null = null;
    const small = width < 420;

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi,
      theta: 0.22,
      dark: 1,
      diffuse: 1.4,
      mapSamples: small ? 9000 : 16000,
      mapBrightness: 5.5,
      mapBaseBrightness: 0.02,
      baseColor: [0.16, 0.3, 0.22],
      markerColor: LIME,
      glowColor: [0.2, 0.42, 0.3],
      markers: [...markers.values()],
      arcs: routes.map((r) => ({ from: r.from, to: r.to, color: settled(r.inv.status) ? LIME : GOLD })),
      arcColor: GOLD,
      arcWidth: 0.6,
      arcHeight: 0.28,
      markerElevation: 0.01,
      opacity: 0.95,
    });

    let frame = 0;
    const tick = () => {
      if (dragX === null) {
        velocity *= 0.95;
        phi += (reduceMotion ? 0 : 0.0022) + velocity;
      }
      globe.update({ phi });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const onDown = (e: PointerEvent) => {
      dragX = e.clientX;
      canvas.style.cursor = 'grabbing';
    };
    const onMove = (e: PointerEvent) => {
      if (dragX === null) return;
      const delta = (e.clientX - dragX) / 220;
      phi += delta;
      velocity = delta * 0.25;
      dragX = e.clientX;
    };
    const onUp = () => {
      dragX = null;
      canvas.style.cursor = 'grab';
    };
    const onResize = () => {
      width = canvas.offsetWidth;
      globe.update({ width: width * 2, height: width * 2 });
    };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('resize', onResize);
    requestAnimationFrame(() => (canvas.style.opacity = '1'));

    return () => {
      cancelAnimationFrame(frame);
      globe.destroy();
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, reduceMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Globe showing live trade routes from African exporters to their buyers"
      className={`aspect-square w-full cursor-grab opacity-0 transition-opacity duration-1000 ${className}`}
      style={{ contain: 'layout paint size' }}
    />
  );
}
