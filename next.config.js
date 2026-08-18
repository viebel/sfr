/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // /rtl was the reader's address before it became the library; links to a page
  // of a book are out in the world, and Next carries their query string over.
  async redirects() {
    return [{ source: '/rtl', destination: '/library', permanent: false }]
  },
}

module.exports = nextConfig

