/** @type {import('next').NextConfig} */
const nextConfig = {
  // Оптимизации для продакшена
  reactStrictMode: true,
  swcMinify: true,
  
  // Оптимизация изображений
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  
  // Компрессия для продакшена
  compress: true,
  
  // Оптимизация сборки
  poweredByHeader: false,
}

module.exports = nextConfig

