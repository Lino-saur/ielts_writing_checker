import React, { type ReactNode, type SVGProps } from "react";

export type LingUiIconName =
  | "arrow-left"
  | "arrow-right"
  | "arrow-up-right"
  | "book"
  | "check"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "chevron-up"
  | "clipboard"
  | "clock"
  | "close"
  | "edit"
  | "eye"
  | "eye-off"
  | "file"
  | "help"
  | "image"
  | "info"
  | "lock"
  | "logout"
  | "mail"
  | "message"
  | "moon"
  | "settings"
  | "sun"
  | "trash"
  | "upload"
  | "user";

const ICONS: Record<LingUiIconName, ReactNode> = {
  "arrow-left": <><path d="M19 12H5" /><path d="m10 7-5 5 5 5" /></>,
  "arrow-right": <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
  "arrow-up-right": <><path d="M7 17 17 7" /><path d="M9 7h8v8" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z" /><path d="M7 7h2M15 7h2" opacity=".42" /></>,
  check: <path d="m5 12.5 4.2 4.2L19 7" />,
  "chevron-down": <path d="m6.5 9 5.5 5.5L17.5 9" />,
  "chevron-left": <path d="m15 6.5-5.5 5.5 5.5 5.5" />,
  "chevron-right": <path d="m9 6.5 5.5 5.5L9 17.5" />,
  "chevron-up": <path d="m6.5 15 5.5-5.5 5.5 5.5" />,
  clipboard: <><rect x="5" y="4.5" width="14" height="16" rx="2.5" /><path d="M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6z" /><path d="M8.5 11h7M8.5 15h5" opacity=".5" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /><path d="M12 3.5v1" opacity=".4" /></>,
  close: <><path d="m6.5 6.5 11 11" /><path d="m17.5 6.5-11 11" /></>,
  edit: <><path d="m5 15.5-1 4.5 4.5-1L18.8 8.7a1.8 1.8 0 0 0 0-2.5l-1-1a1.8 1.8 0 0 0-2.5 0z" /><path d="m13.8 6.7 3.5 3.5" /><path d="M5 15.5 8.5 19" opacity=".45" /></>,
  eye: <><path d="M3.5 12s3-5.5 8.5-5.5 8.5 5.5 8.5 5.5-3 5.5-8.5 5.5S3.5 12 3.5 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
  "eye-off": <><path d="M4 4 20 20" /><path d="M9.5 7A8.8 8.8 0 0 1 12 6.5c5.5 0 8.5 5.5 8.5 5.5a13 13 0 0 1-2.1 2.8M14.7 17A8.4 8.4 0 0 1 12 17.5C6.5 17.5 3.5 12 3.5 12a13 13 0 0 1 2.2-2.9" /><path d="M10.2 10.2a2.5 2.5 0 0 0 3.6 3.6" /></>,
  file: <><path d="M6 3.5h7l5 5v12H6z" /><path d="M13 3.5v5h5" /><path d="M9 13h6M9 16.5h4" opacity=".5" /></>,
  help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.7 9a2.5 2.5 0 1 1 3.2 2.4c-.8.3-.9 1-.9 1.6" /><path d="M12 16.5h.01" /></>,
  image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="8.5" cy="9" r="1.5" /><path d="m5.5 17 4.2-4.2 2.8 2.7 2.2-2.2 3.8 3.7" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 10.5v6" /><path d="M12 7.5h.01" /></>,
  lock: <><rect x="5" y="10" width="14" height="10.5" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 14v2.5" /></>,
  logout: <><path d="M10 5H6v14h4" /><path d="M13 8.5 16.5 12 13 15.5M16.5 12H9" /></>,
  mail: <><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><path d="m5 7 7 5 7-5" /></>,
  message: <><path d="M4 5.5h16v11H9l-5 4z" /><path d="M8 10h8M8 13h5" opacity=".5" /></>,
  moon: <path d="M18.5 15.5A7.5 7.5 0 0 1 8.5 5.4a8 8 0 1 0 10 10.1Z" />,
  settings: <><path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4A2 2 0 0 0 4 9.9l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.8l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.8v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z" /><circle cx="12" cy="12" r="3" /></>,
  sun: <><circle cx="12" cy="12" r="3.5" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" /></>,
  trash: <><path d="M5.5 7.5h13M9 7.5v-3h6v3M7 7.5l1 13h8l1-13" /><path d="M10 11v5.5M14 11v5.5" opacity=".55" /></>,
  upload: <><path d="M12 15V4" /><path d="m7.5 8.5 4.5-4.5 4.5 4.5" /><path d="M5 14v5.5h14V14" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>
};

export function LingUiIcon({
  name,
  size = 20,
  title,
  className,
  ...props
}: Omit<SVGProps<SVGSVGElement>, "children"> & {
  name: LingUiIconName;
  size?: number;
  title?: string;
}) {
  return (
    <svg
      className={["lingUiIcon", className].filter(Boolean).join(" ")}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {ICONS[name]}
    </svg>
  );
}

export const LING_UI_ICON_NAMES = Object.keys(ICONS) as LingUiIconName[];
