import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: { "/api/tiers/*/export": ["./public/fonts/Pretendard-Regular.otf"], "/api/og/tiers": ["./public/fonts/Pretendard-Regular.otf"], "/api/og/tiers/*": ["./public/fonts/Pretendard-Regular.otf"] },
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  // Auth links, share capabilities and action arguments can contain credentials.
  logging: { incomingRequests: { ignore: [/\/auth(?:\/|\?)/,/\/share\/t(?:\/|\?)/] }, serverFunctions: false, browserToTerminal: false },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" }
      ]
    }, {
      source: "/api/tiers/:path*",
      headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }],
    }, {
      source: "/api/og/tiers/:path*",
      headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }],
    }, {
      source: "/auth/:path*",
      headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }],
    }, {
      source: "/share/:path*",
      headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }],
    }, {
      source: "/tiers/:path*",
      headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "Referrer-Policy", value: "no-referrer" }],
    }, {
      source: "/u/:path*",
      headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "Referrer-Policy", value: "no-referrer" }],
    }, {
      source: "/compare/:path*",
      headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }],
    }, {
      source: "/me/:path*",
      headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "Referrer-Policy", value: "no-referrer" }],
    }, {
      source: "/settings/:path*",
      headers: [{ key: "Cache-Control", value: "private, no-store" }],
    }, {
      source: "/onboarding",
      headers: [{ key: "Cache-Control", value: "private, no-store" }],
    }, {
      source: "/admin/:path*",
      headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "Referrer-Policy", value: "no-referrer" }],
    }, {
      source: "/submissions/:path*",
      headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "Referrer-Policy", value: "no-referrer" }],
    }];
  }
};
export default nextConfig;
