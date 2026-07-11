/** @type {import('next').NextConfig} */
const nextConfig = {
  // ExcelJS is a Node-only library used by the /frt-directory/export route.
  // Keep it external so it's required from node_modules at runtime instead of
  // being bundled into the server graph.
  experimental: {
    serverComponentsExternalPackages: ["exceljs"],
  },
};

export default nextConfig;
