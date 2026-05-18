import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['212.85.0.221'],
  devIndicators: false,
}

export default nextConfig