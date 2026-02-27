import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Performance and security
  reactStrictMode: true,
  poweredByHeader: false,

  // Compress responses
  compress: true,

  // Build configuration - ignore TypeScript errors for deployment
  typescript: {
    ignoreBuildErrors: true,
  },

  // Turbopack configuration
  turbopack: {},

  // Disable source maps for production
  productionBrowserSourceMaps: false,

  // Webpack config for non-Turbopack builds
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Optimize chunk splitting for large bundles
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization?.splitChunks,
          chunks: 'all',
          maxSize: 500000, // 500KB max chunk size
          cacheGroups: {
            // Vendor chunk for node_modules
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }

    return config;
  },

  // Security headers (no X-Frame-Options to allow Farcaster iframe embedding)
  async headers() {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      `connect-src 'self' ${apiUrl} ${wsUrl} https://*.walletconnect.com wss://*.walletconnect.com https://sepolia.base.org https://mainnet.base.org`,
      "frame-ancestors 'self' https://warpcast.com https://*.farcaster.xyz",
      "object-src 'none'",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },
};

export default nextConfig;
