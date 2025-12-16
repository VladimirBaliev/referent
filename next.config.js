/** @type {import('next').NextConfig} */
const nextConfig = {
  // Оптимизации для продакшена
  reactStrictMode: true,
  swcMinify: true,
  // Оптимизация изображений
  images: {
    formats: ['image/avif', 'image/webp'],
  },
}

module.exports = nextConfig

