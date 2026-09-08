import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "Booking" was renamed to "Mix" site-wide (2026-09-08, AdSense gambling-
  // terminology compliance pass) — permanent redirects so links already
  // shared publicly (Telegram posts, etc.) keep working instead of 404ing.
  async redirects() {
    return [
      { source: "/bookings/:path*", destination: "/mixes/:path*", permanent: true },
      { source: "/account/bookings", destination: "/account/mixes", permanent: true },
      { source: "/top-bookings", destination: "/top-mixes", permanent: true },
    ];
  },
};

export default nextConfig;
