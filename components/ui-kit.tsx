"use client";

import Link from "next/link";
import { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "article" | "form" | "header";
  tone?: "default" | "soft";
};

export function Surface({ as = "div", tone = "default", className, ...props }: SurfaceProps) {
  const Component = as;
  return <Component className={joinClasses("uiSurface", tone === "soft" && "uiSurfaceSoft", className)} {...props} />;
}

type PillProps = HTMLAttributes<HTMLElement> & {
  as?: "span" | "div";
};

export function Pill({ as = "span", className, ...props }: PillProps) {
  const Component = as;
  return <Component className={joinClasses("uiPill", className)} {...props} />;
}

type SectionIntroProps = {
  eyebrow: string;
  title: string;
  body?: string;
  className?: string;
};

export function SectionIntro({ eyebrow, title, body, className }: SectionIntroProps) {
  return (
    <div className={joinClasses("productSectionIntro", "uiSurface", className)}>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {body ? <p className="uiSectionBody">{body}</p> : null}
    </div>
  );
}

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "plain";
  fullWidth?: boolean;
};

export function ActionButton({
  variant = "secondary",
  fullWidth = false,
  className,
  type = "button",
  ...props
}: ActionButtonProps) {
  return (
    <button
      type={type}
      className={joinClasses(
        variant === "primary"
          ? "primaryAction uiButton uiButtonPrimary"
          : variant === "plain"
            ? "uiButton"
            : "ghostAction uiButton",
        fullWidth && "uiButtonBlock",
        className
      )}
      {...props}
    />
  );
}

type ActionLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
};

export function ActionLink({
  href,
  children,
  className,
  variant = "secondary",
  fullWidth = false
}: ActionLinkProps) {
  return (
    <Link
      href={href}
      className={joinClasses(
        variant === "primary" ? "primaryAction uiButton uiButtonPrimary" : "ghostAction uiButton",
        fullWidth && "uiButtonBlock",
        className
      )}
    >
      {children}
    </Link>
  );
}
