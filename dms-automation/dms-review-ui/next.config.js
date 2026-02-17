/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
}

module.exports = nextConfig
