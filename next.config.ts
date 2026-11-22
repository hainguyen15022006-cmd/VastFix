import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
