"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DotLottieReact, type DotLottie } from "@lottiefiles/dotlottie-react";

type LoadingLottieProps = {
  className?: string;
  fullscreen?: boolean;
  label?: string;
  showLabel?: boolean;
  size?: "small" | "medium" | "large";
};

export function LoadingLottie({
  className = "",
  fullscreen = false,
  label,
  showLabel = true,
  size = "medium"
}: LoadingLottieProps) {
  const pathname = usePathname();
  const [dotLottie, setDotLottie] = useState<DotLottie | null>(null);
  const resolvedLabel = label ?? (pathname.startsWith("/zh-CN") ? "正在加载…" : "Loading…");

  useEffect(() => {
    if (!dotLottie) return;
    const player = dotLottie;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function syncMotionPreference() {
      if (reducedMotion.matches) {
        player.pause();
        player.setFrame(30);
      } else {
        player.play();
      }
    }

    syncMotionPreference();
    reducedMotion.addEventListener("change", syncMotionPreference);
    return () => reducedMotion.removeEventListener("change", syncMotionPreference);
  }, [dotLottie]);

  return (
    <div
      className={`globalLoading${fullscreen ? " globalLoadingFullscreen" : ""} globalLoading-${size}${className ? ` ${className}` : ""}`}
      role="status"
      aria-live="polite"
      aria-label={resolvedLabel}
    >
      <div className="globalLoadingAnimation" aria-hidden="true">
        <DotLottieReact
          src="/lottie/loading.lottie"
          autoplay
          loop
          dotLottieRefCallback={setDotLottie}
          layout={{ fit: "contain", align: [0.5, 0.5] }}
          renderConfig={{ autoResize: true }}
        />
      </div>
      {showLabel ? <span className="globalLoadingLabel">{resolvedLabel}</span> : null}
    </div>
  );
}
