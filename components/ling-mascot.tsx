export type LingMascotState = "empty" | "reviewing" | "rewrite" | "progress";
export type LingMascotSize = "small" | "medium" | "large";

type LingMascotAsset = {
  src: string;
  width: number;
  height: number;
};

const LING_MASCOT_ASSETS: Record<LingMascotState, LingMascotAsset> = {
  empty: {
    src: "/mascot/ling-empty-v1.webp",
    width: 813,
    height: 1161
  },
  reviewing: {
    src: "/mascot/ling-reviewing-v1.webp",
    width: 1254,
    height: 1254
  },
  rewrite: {
    src: "/mascot/ling-rewrite-v1.webp",
    width: 921,
    height: 1192
  },
  progress: {
    src: "/mascot/ling-progress-v1.webp",
    width: 749,
    height: 1183
  }
};

export function LingMascot({
  state,
  size = "medium",
  motion = false,
  label,
  className
}: {
  state: LingMascotState;
  size?: LingMascotSize;
  motion?: boolean;
  label?: string;
  className?: string;
}) {
  const asset = LING_MASCOT_ASSETS[state];
  const classes = [
    "lingMascot",
    `is-${state}`,
    `is-${size}`,
    motion ? "has-motion" : "",
    className ?? ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} aria-hidden={label ? undefined : true}>
      {/* These small static public assets intentionally bypass Next's image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="lingMascotImage"
        src={asset.src}
        alt={label ?? ""}
        width={asset.width}
        height={asset.height}
        draggable={false}
      />
    </span>
  );
}
