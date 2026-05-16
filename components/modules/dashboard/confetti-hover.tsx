"use client";

import { useRef } from "react";

export function ConfettiHover({
  active = false,
  className,
  style,
  children,
}: {
  active?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastFired = useRef(0);

  async function celebrate() {
    if (!active) return;
    const now = Date.now();
    if (now - lastFired.current < 1500) return; // evita disparos repetidos
    lastFired.current = now;

    const { default: confetti } = await import("canvas-confetti");
    const el = ref.current;
    const rect = el?.getBoundingClientRect();
    const origin = rect
      ? {
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        }
      : { x: 0.5, y: 0.4 };

    const colors = [
      "#FF3B6B",
      "#FF8A00",
      "#FFD400",
      "#21D07A",
      "#00B3FF",
      "#7C4DFF",
      "#FF4FD8",
    ];

    // Estouro central + dois canhões laterais para um efeito festivo
    confetti({
      particleCount: 120,
      spread: 90,
      startVelocity: 42,
      origin,
      colors,
      scalar: 1,
      ticks: 220,
      disableForReducedMotion: true,
    });
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.7 },
      colors,
      disableForReducedMotion: true,
    });
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.7 },
      colors,
      disableForReducedMotion: true,
    });
  }

  return (
    <div
      ref={ref}
      className={className}
      style={style}
      onMouseEnter={celebrate}
      onFocusCapture={celebrate}
    >
      {children}
    </div>
  );
}
