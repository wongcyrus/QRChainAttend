/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Configure for Azure Static Web Apps
  trailingSlash: true,
  // API proxy to Azure Functions
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7071/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
