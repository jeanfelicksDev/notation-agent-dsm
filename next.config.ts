import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Racine explicite : évite que Turbopack remonte vers un dépôt parent (worktrees imbriqués).
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
