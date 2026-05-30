/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ]
  },
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
}

module.exports = nextConfig
