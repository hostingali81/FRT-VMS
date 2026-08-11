/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Node-only libraries used by the /frt-directory export routes (ExcelJS for
    // .xlsx; puppeteer-core + @sparticuz/chromium for the headless-Chrome PDF).
    // Keep them external so they're required from node_modules at runtime instead
    // of being bundled/relocated into the server graph.
    serverComponentsExternalPackages: ["exceljs", "puppeteer-core", "@sparticuz/chromium"],
    // @sparticuz/chromium loads its Chromium binary from bin/ at runtime via an fs
    // path, so Next's file tracing can't detect it — force the whole package (incl.
    // bin/chromium.br) into the /frt-directory/pdf serverless function.
    outputFileTracingIncludes: {
      // Next keys app route handlers as ".../route"; include both forms so the
      // match holds across Next versions.
      "/frt-directory/pdf": ["./node_modules/@sparticuz/chromium/**/*"],
      "/frt-directory/pdf/route": ["./node_modules/@sparticuz/chromium/**/*"],
      // /api/public/docs reads docs/public-api.md off disk at request time; tracing
      // can't see that path either, so ship the file with the function.
      "/api/public/docs": ["./docs/public-api.md"],
      "/api/public/docs/route": ["./docs/public-api.md"],
    },
  },
};

export default nextConfig;
