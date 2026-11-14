/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Image Docker légère : Next.js copie seulement ce qui est nécessaire dans .next/standalone
  output: "standalone",
};

export default nextConfig;
