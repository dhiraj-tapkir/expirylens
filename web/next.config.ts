import type { NextConfig } from "next";

// the site is published as plain static files on GitHub Pages at
// https://dhiraj-tapkir.github.io/expirylens/
const nextConfig: NextConfig = {
  output: "export",
  basePath: "/expirylens",
  images: { unoptimized: true },

  // tailwind v4 runs as a turbopack loader on every css file
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
