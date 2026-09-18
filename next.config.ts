import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https://img.clerk.com https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://*.supabase.co",
      "frame-src https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core", "exceljs", "postgres"],
  // @sparticuz/chromium ships its browser as brotli archives in bin/; they are opened at
  // runtime, so file tracing never sees them and the deployed function had no browser
  // ("The input directory …/@sparticuz/chromium/bin does not exist"). Ship them with every
  // route: invoice PDFs come from a server action on /invoices/[id], report PDFs from /reports.
  outputFileTracingIncludes: { "/**/*": ["./node_modules/@sparticuz/chromium/bin/**"] },
  experimental: {
    serverActions: { bodySizeLimit: "60mb" },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
