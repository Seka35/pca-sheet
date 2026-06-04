/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 et googleapis doivent rester externes (non bundlés).
  // better-sqlite3 est un module natif; googleapis est trop gros pour le bundler.
  serverExternalPackages: ['better-sqlite3', 'googleapis'],
  // Désactive Turbopack pour le dev et le build — webpack gère mieux les
  // modules natifs comme better-sqlite3
  turbopack: undefined,
};

export default nextConfig;
