/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 et googleapis doivent rester externes (non bundlés).
  // better-sqlite3 est un module natif; googleapis est trop gros pour le bundler.
  serverExternalPackages: ['better-sqlite3', 'googleapis', 'node-telegram-bot-api'],
  // Désactive Turbopack pour le dev et le build — webpack gère mieux les
  // modules natifs comme better-sqlite3
  turbopack: undefined,
  // node-telegram-bot-api embarque @cypress/request, bl, pump, etc. qui
  // require('os' | 'fs' | 'stream'). serverExternalPackages ne suffit pas
  // pour instrumentation.js, on externalise donc explicitement ces modules
  // via webpack (sur le runtime serveur uniquement).
  webpack: (config, { isServer }) => {
    if (isServer && config.externals) {
      const externalsArray = Array.isArray(config.externals) ? config.externals : [config.externals];
      externalsArray.push(({ request }, callback) => {
        if (!request) return callback();
        // Externalise les modules natifs Node et les deps CJS du bot.
        if (
          /^node-telegram-bot-api(\/|$)/.test(request) ||
          /^@cypress\/request/.test(request) ||
          /^@cypress\/request-promise/.test(request) ||
          /^bl(\/|$)/.test(request) ||
          /^pump(\/|$)/.test(request) ||
          /^bindings(\/|$)/.test(request) ||
          /^file-uri-to-path(\/|$)/.test(request) ||
          /^request-promise(\/|$)/.test(request) ||
          /^(path|fs|os|crypto|stream|util|http|https|url|net|tls|child_process|events|querystring|buffer|zlib)$/.test(request)
        ) {
          return callback(null, 'commonjs ' + request);
        }
        callback();
      });
      config.externals = externalsArray;
    }
    return config;
  },
};

export default nextConfig;
