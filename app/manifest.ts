import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IELTS Writing Checker",
    short_name: "IELTS Checker",
    description: "AI-assisted IELTS writing review for Task 1 and Task 2.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f4",
    theme_color: "#1d524b",
    icons: [
      { src: "/app-icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/app-icons/icon-512x512.png", sizes: "512x512", type: "image/png" }
    ]
  };
}
