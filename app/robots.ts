import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://ielts-writing-checker.com";
  return {
    rules: [{
      userAgent: "*",
      allow: ["/", "/zh-CN", "/en", "/zh-CN/privacy", "/en/privacy", "/zh-CN/terms", "/en/terms", "/zh-CN/refund", "/en/refund"],
      disallow: [
        "/admin",
        "/api",
        "/checker",
        "/history",
        "/orders",
        "/assignments",
        "/practice",
        "/share",
        "/*/checker",
        "/*/history",
        "/*/orders",
        "/*/assignments",
        "/*/practice"
      ]
    }],
    sitemap: `${baseUrl}/sitemap.xml`
  };
}
