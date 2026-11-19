import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["passkit-generator", "sharp"],
  logging: {
    // Pass URLs contain card details and download tokens.
    incomingRequests: { ignore: [/\/api\/pass/] },
  },
};

export default nextConfig;
