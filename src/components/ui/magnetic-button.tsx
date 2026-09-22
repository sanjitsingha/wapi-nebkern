"use client";

import React, { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

// From the Aceternity registry (`@aceternity/magnetic-button`), with two
// additions: a `className` merged over the wrapper's defaults — so a
// caller can change its shape, cursor and field colour (`--show-color`)
// — and no movement at all for people who have asked their OS for
// reduced motion.
export const MagneticButton = ({
  children,
  strength = 0.8,
  maxDistance = 100,
  className,
}: {
  children: React.ReactNode;
  strength?: number;
  maxDistance?: number;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const reduceMotion = useReducedMotion();

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current || reduceMotion) return;

    const { width, height, left, top } = ref.current.getBoundingClientRect();
    const { clientX, clientY } = e;

    let x = (clientX - (left + width / 2)) * strength;
    let y = (clientY - (top + height / 2)) * strength;

    const distance = Math.hypot(x, y);
    if (distance > maxDistance) {
      const scale = maxDistance / distance;
      x *= scale;
      y *= scale;
    }

    setPosition({ x, y });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  const hasMoved = position.x !== 0 || position.y !== 0;
  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "cursor-pointer rounded-lg border border-dashed transition-colors duration-150 [--show-color:var(--color-blue-500)]",
        className,
      )}
      style={{
        borderColor: hasMoved ? "var(--show-color)" : "transparent",
        backgroundColor: hasMoved
          ? "color-mix(in srgb,var(--show-color) 20%, transparent)"
          : "transparent",
      }}
    >
      <motion.div
        ref={ref}
        animate={{ x: position.x, y: position.y }}
        transition={{ type: "spring", stiffness: 150, damping: 25, mass: 0.1 }}
      >
        {children}
      </motion.div>
    </div>
  );
};

/**
 * The public pages' standard magnetic wrap, so the tuning lives in one
 * place rather than being retyped at every button.
 *
 * `strength`/`maxDistance` are deliberately small: these buttons sit in
 * navs, card footers and CTA rows, often shoulder to shoulder, and a
 * 14px lean is enough to feel alive without landing on a neighbour.
 *
 * `w-fit` because the wrapper is a div — left block-level it runs the
 * width of its container, and the field it paints on hover goes with
 * it. `radius` matches the field to the button inside: `lg` for the
 * hard-shadow buttons, `full` for the pills.
 *
 * `--show-color` resolves per design: the WhatsApp pages define
 * `--wa-green`, and where they don't (the playful design, which shares
 * this nav) it falls back to `--lp2-grass`.
 */
export function Magnetic({
  children,
  radius = 'lg',
  className,
}: {
  children: React.ReactNode;
  radius?: 'lg' | 'full';
  className?: string;
}) {
  return (
    <MagneticButton
      strength={0.35}
      maxDistance={14}
      className={cn(
        'w-fit [--show-color:var(--wa-green,var(--lp2-grass))]',
        radius === 'full' ? 'rounded-full' : 'rounded-lg',
        className,
      )}
    >
      {children}
    </MagneticButton>
  );
}
