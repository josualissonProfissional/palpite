"use client";

import * as React from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
} from "motion/react";

import { cn } from "@/lib/utils";

type MagicCardProps = {
  children?: React.ReactNode;
  className?: string;
  gradientSize?: number;
  gradientColor?: string;
  gradientOpacity?: number;
  gradientFrom?: string;
  gradientTo?: string;
};

export function MagicCard({
  children,
  className,
  gradientSize = 180,
  gradientColor = "rgba(37, 99, 235, 0.12)",
  gradientFrom = "rgba(37, 99, 235, 0.75)",
  gradientTo = "rgba(14, 165, 233, 0.45)",
}: MagicCardProps) {
  const mouseX = useMotionValue(-gradientSize);
  const mouseY = useMotionValue(-gradientSize);

  const borderBackground = useMotionTemplate`
    linear-gradient(var(--color-background) 0 0) padding-box,
    radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
      ${gradientFrom},
      ${gradientTo},
      var(--color-border) 100%
    ) border-box
  `;

  const spotlightBackground = useMotionTemplate`
    radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
      ${gradientColor},
      transparent 100%
    )
  `;

  const reset = React.useCallback(() => {
    mouseX.set(-gradientSize);
    mouseY.set(-gradientSize);
  }, [gradientSize, mouseX, mouseY]);

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      mouseX.set(event.clientX - rect.left);
      mouseY.set(event.clientY - rect.top);
    },
    [mouseX, mouseY],
  );

  React.useEffect(() => {
    reset();
  }, [reset]);

  return (
    <motion.div
      className={cn(
        "group/magic-card relative isolate overflow-hidden rounded-xl border border-transparent",
        className,
      )}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      style={{ background: borderBackground }}
    >
      <div className="absolute inset-px z-0 rounded-[inherit] bg-background" />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-px z-10 rounded-[inherit] opacity-0 transition-opacity duration-200 group-hover/magic-card:opacity-100"
        style={{ background: spotlightBackground }}
      />
      <div className="relative z-20">{children}</div>
    </motion.div>
  );
}
