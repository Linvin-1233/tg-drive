import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

if (process.env.NODE_ENV === "development" && !process.env.VERCEL) {
  import('@opennextjs/cloudflare')
    .then(m => m.initOpenNextCloudflareForDev())
    .catch(err => console.error("Cloudflare dev init failed:", err));
}

export default nextConfig;
