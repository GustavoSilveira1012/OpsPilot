import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@opspilot/contracts'],
  poweredByHeader: false,
};

export default nextConfig;
