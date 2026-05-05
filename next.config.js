/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'
const repoName = 'aussie-house-buyer'

const nextConfig = {
  output: 'export',
  basePath: isProd ? `/${repoName}` : '',
  assetPrefix: isProd ? `/${repoName}/` : '',
  images: { unoptimized: true },
  trailingSlash: true,
}

module.exports = nextConfig
