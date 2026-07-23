"use client";

import { CSSProperties, useEffect, useState } from "react";

export type LingPetState = "idle" | "waving" | "failed" | "waiting" | "running" | "review";
export type LingPetSize = "small" | "medium" | "large";

type LingPetAnimation = {
  src: string;
  frameCount: number;
  durations: readonly number[];
};

export const LING_PET_ANIMATIONS: Record<LingPetState, LingPetAnimation> = {
  idle: {
    src: "/mascot/pet/ling-idle-v1.webp",
    frameCount: 6,
    durations: [280, 110, 110, 140, 140, 320]
  },
  waving: {
    src: "/mascot/pet/ling-waving-v1.webp",
    frameCount: 4,
    durations: [140, 140, 140, 280]
  },
  failed: {
    src: "/mascot/pet/ling-failed-v1.webp",
    frameCount: 8,
    durations: [140, 140, 140, 140, 140, 140, 140, 240]
  },
  waiting: {
    src: "/mascot/pet/ling-waiting-v1.webp",
    frameCount: 6,
    durations: [150, 150, 150, 150, 150, 260]
  },
  running: {
    src: "/mascot/pet/ling-running-v1.webp",
    frameCount: 6,
    durations: [120, 120, 120, 120, 120, 220]
  },
  review: {
    src: "/mascot/pet/ling-review-v1.webp",
    frameCount: 6,
    durations: [150, 150, 150, 150, 150, 280]
  }
};

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setReducedMotion(mediaQuery.matches);

    syncPreference();
    mediaQuery.addEventListener("change", syncPreference);
    return () => mediaQuery.removeEventListener("change", syncPreference);
  }, []);

  return reducedMotion;
}

export function LingPet({
  state,
  size = "medium",
  motion = true,
  loop = true,
  loading = "lazy",
  label,
  className,
  onCycleComplete
}: {
  state: LingPetState;
  size?: LingPetSize;
  motion?: boolean;
  loop?: boolean;
  loading?: "eager" | "lazy";
  label?: string;
  className?: string;
  onCycleComplete?: () => void;
}) {
  const animation = LING_PET_ANIMATIONS[state];
  const reducedMotion = usePrefersReducedMotion();
  const [frame, setFrame] = useState(0);
  const visibleFrame = Math.min(frame, animation.frameCount - 1);

  useEffect(() => {
    setFrame(0);
  }, [state]);

  useEffect(() => {
    if (!motion || reducedMotion || (!loop && visibleFrame === animation.frameCount - 1)) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const nextFrame = visibleFrame + 1;
      if (nextFrame >= animation.frameCount) {
        onCycleComplete?.();
        setFrame(loop ? 0 : visibleFrame);
        return;
      }
      setFrame(nextFrame);
    }, animation.durations[visibleFrame]);

    return () => window.clearTimeout(timeout);
  }, [animation, loop, motion, onCycleComplete, reducedMotion, visibleFrame]);

  const classes = ["lingPet", `is-${size}`, `is-${state}`, className ?? ""].filter(Boolean).join(" ");
  const imageStyle = {
    width: `${animation.frameCount * 100}%`,
    transform: `translate3d(-${(visibleFrame / animation.frameCount) * 100}%, 0, 0)`
  } satisfies CSSProperties;

  return (
    <span
      className={classes}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-state={state}
      data-frame={visibleFrame}
    >
      {/* The strip is already optimized and must retain exact cell geometry. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="lingPetStrip"
        src={animation.src}
        alt=""
        width={animation.frameCount * 192}
        height={208}
        loading={loading}
        draggable={false}
        style={imageStyle}
      />
    </span>
  );
}
