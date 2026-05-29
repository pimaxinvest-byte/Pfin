/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ]
  },
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
}

module.exports = nextConfig
