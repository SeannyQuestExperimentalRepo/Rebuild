/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // All game data (NFL, NCAAF, NCAAMB) now served from PostgreSQL.
    // Player data (nfl-player-games.json) still on disk but too large for serverless.
    // Player search will need DB migration in the future.
    // Exclude ALL data files from serverless bundles.
    outputFileTracingExcludes: {
      "*": [
        "./data",
      ],
    },
    // Force-include Next.js internal modules that file tracing misses
    // when building locally with `vercel build --prod`.
    // Without this, serverless functions crash with missing module errors
    // (get-metadata-route, hash, match-next-data-pathname, etc.).
    outputFileTracingIncludes: {
      "*": [
        "./node_modules/next/dist/**/*.js",
      ],
    },
  },
};

export default nextConfig;
