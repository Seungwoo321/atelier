import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: "/", lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: "/dashboard", lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: "/office", lastModified: now, changeFrequency: "hourly", priority: 0.8 },
  ];
}
