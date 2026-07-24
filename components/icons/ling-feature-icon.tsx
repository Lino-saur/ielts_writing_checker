export type LingFeatureIconName =
  | "avatar"
  | "feather"
  | "historical-practice"
  | "magic-ink"
  | "practice-library"
  | "workflow-diagnose"
  | "workflow-rewrite"
  | "workflow-submit";

const ASSETS: Record<LingFeatureIconName, string> = {
  avatar: "/app-icons/icon.png",
  feather: "/app-icons/ling-feather-loop.png",
  "historical-practice": "/app-icons/practice/ling-historical-practice-v1.png",
  "magic-ink": "/app-icons/magic-ink.png",
  "practice-library": "/app-icons/practice/ling-practice-library-v1.png",
  "workflow-diagnose": "/app-icons/workflow/ling-workflow-diagnose-v1.png",
  "workflow-rewrite": "/app-icons/workflow/ling-workflow-rewrite-v1.png",
  "workflow-submit": "/app-icons/workflow/ling-workflow-submit-v1.png"
};

export function LingFeatureIcon({
  name,
  size = 48,
  label,
  className
}: {
  name: LingFeatureIconName;
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    // These small static public assets intentionally bypass Next's image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={["lingFeatureIcon", className].filter(Boolean).join(" ")}
      src={ASSETS[name]}
      alt={label ?? ""}
      width={size}
      height={size}
      aria-hidden={label ? undefined : true}
      draggable={false}
    />
  );
}
