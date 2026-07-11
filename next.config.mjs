/** @type {import('next').NextConfig} */
const nextConfig = {
  // Node-only libraries used by the /frt-directory export routes (ExcelJS for
  // .xlsx; puppeteer-core + @sparticuz/chromium for the headless-Chrome PDF).
  // Keep them external so they're required from node_modules at runtime instead
  // of being bundled into the server graph.
  experimental: {
    serverComponentsExternalPackages: ["exceljs", "puppeteer-core", "@sparticuz/chromium"],
  },
};

export default nextConfig;
