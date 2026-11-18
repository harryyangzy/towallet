import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["passkit-generator"],
  outputFileTracingIncludes: {
    "/api/pass": ["./public/pass-artwork/**/*.png"],
  },
};

export default nextConfig;
