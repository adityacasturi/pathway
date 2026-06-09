import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pathway",
    short_name: "Pathway",
    description: "Internship application tracker.",
    start_url: "/home",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#f9fafb",
    icons: [
      {
        src: "/icon.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/brand/pathway-favicon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
