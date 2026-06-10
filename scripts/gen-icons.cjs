// Regenerates the app/PWA icons with the FRT-VMS wordmark.
// Design: blue gradient rounded tile + lucide "truck" line glyph + "FRT-VMS".
// Run: node scripts/gen-icons.cjs
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "public");

// Wrap a PNG buffer in a single-image .ico container (browsers accept PNG-in-ICO).
function pngToIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size & 0xff, 0); // width (0 => 256)
  entry.writeUInt8(size & 0xff, 1); // height
  entry.writeUInt8(0, 2); // palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // image size
  entry.writeUInt32LE(22, 12); // offset (6 + 16)
  return Buffer.concat([header, entry, png]);
}

// lucide-react "truck" icon paths (24x24 viewBox), drawn as white strokes.
const TRUCK = `
  <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
  <path d="M15 18H9"/>
  <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
  <circle cx="17" cy="18" r="2"/>
  <circle cx="7" cy="18" r="2"/>
`;

const GRAD = (w, h) => `
  <linearGradient id="g" x1="0" y1="0" x2="${w}" y2="${h}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#3b82f6"/>
    <stop offset="1" stop-color="#1e3a8a"/>
  </linearGradient>`;

// 512-space master: truck glyph above a centred FRT-VMS wordmark.
function master({ rounded, withText, scale = 1 }) {
  const s = 9.17; // truck 24-viewBox -> ~220px wide
  const tx = (256 - 12 * s).toFixed(2);
  const ty = (195 - 12 * s).toFixed(2);
  const truck = `<g transform="translate(${tx} ${ty}) scale(${s})" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TRUCK}</g>`;
  const text = withText
    ? `<text x="256" y="408" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="74" font-weight="700" letter-spacing="3" fill="#ffffff">FRT-VMS</text>`
    : "";
  const content = `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${truck}${text}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
    <defs>${GRAD(512, 512)}</defs>
    <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#g)"/>
    ${content}
  </svg>`;
}

// Tiny tab favicon: glyph only (text is illegible at 32px).
function favicon() {
  const s = 1.1;
  const tx = (16 - 12 * s).toFixed(2);
  const ty = (16 - 12 * s).toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
    <defs>${GRAD(32, 32)}</defs>
    <rect width="32" height="32" rx="7" fill="url(#g)"/>
    <g transform="translate(${tx} ${ty}) scale(${s})" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TRUCK}</g>
  </svg>`;
}

const render = (svg, size, file) =>
  sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(OUT, file));

(async () => {
  const main = master({ rounded: true, withText: true });
  const apple = master({ rounded: false, withText: true });
  const maskable = master({ rounded: false, withText: true, scale: 0.78 });

  await Promise.all([
    render(main, 512, "icon-512.png"),
    render(main, 192, "icon-192.png"),
    render(apple, 180, "apple-touch-icon.png"),
    render(maskable, 512, "icon-maskable-512.png"),
    render(maskable, 192, "icon-maskable-192.png"),
    render(favicon(), 32, "favicon-32.png"),
  ]);

  // Tab favicon (app/favicon.ico) — 48px glyph wrapped as PNG-in-ICO.
  const icoPng = await sharp(Buffer.from(favicon())).resize(48, 48).png().toBuffer();
  fs.writeFileSync(path.join(__dirname, "..", "app", "favicon.ico"), pngToIco(icoPng, 48));

  console.log("Icons regenerated in /public and app/favicon.ico");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
