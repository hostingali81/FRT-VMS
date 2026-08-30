import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { DocEnhancements } from "@/components/docs/DocEnhancements";
import { renderMarkdownDoc } from "@/lib/utils/markdown-doc";

// PUBLIC documentation page for the /api/public endpoints.
// Whitelisted in middleware.ts (publicPaths "/api-docs") so it bypasses the login
// gate — share https://frtvms.vercel.app/api-docs with anyone.
//
// The body is docs/public-api.md rendered at request time, so the page and the
// repo doc can never drift apart. next.config.mjs traces that .md file into this
// route's bundle. The renderer (lib/utils/markdown-doc.ts) covers only the
// constructs the doc uses — keep the doc to those.
export const dynamic = "force-dynamic";

const DOC_PATH = path.join(process.cwd(), "docs", "public-api.md");

export const metadata: Metadata = {
  title: "Public API — FRT VMS",
  description:
    "Open, read-only JSON endpoints of the FRT Vehicle Management System: fleet fuel consumption, mileage, distance and vehicle details.",
};

/** Live endpoints, surfaced as cards above the prose so they're one click away. */
const ENDPOINTS = [
  {
    path: "/api/public/fuel",
    anchor: "#get-api-public-fuel",
    title: "Fuel & mileage",
    blurb: "Fill-ups, litres, cost, GPS distance and km/L per vehicle — the Fuel Dashboard as JSON.",
  },
  {
    path: "/api/public/vehicles",
    anchor: "#get-api-public-vehicles",
    title: "Vehicles",
    blurb: "The fleet's deployment, GPS and vendor fields as a flat array.",
  },
  {
    path: "/api/public/gps-names",
    anchor: "#get-api-public-gps-names",
    title: "GPS device names",
    blurb: "GPS device id ↔ FRT deployment label, for both tracking providers.",
  },
];

export default async function ApiDocsPage() {
  let markdown: string;
  try {
    markdown = await readFile(DOC_PATH, "utf8");
  } catch (error) {
    console.error("[/api-docs] couldn't read docs/public-api.md:", error);
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Documentation is unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">
          The API itself is unaffected — try{" "}
          <a className="font-medium text-blue-700 underline" href="/api/public/fuel">
            /api/public/fuel
          </a>
          .
        </p>
      </main>
    );
  }

  // The .md keeps its own H1 for GitHub; the page shows it in the hero instead of
  // repeating it at the top of the prose.
  const title = markdown.match(/^#\s+(.*)$/m)?.[1] ?? "Public API";
  const { html, headings } = renderMarkdownDoc(markdown.replace(/^#\s+.*$/m, "").trimStart());

  return (
    <div className="min-h-screen bg-white">
      <style dangerouslySetInnerHTML={{ __html: DOC_STYLES }} />

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/api-docs" className="flex items-center gap-2.5 text-white">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-blue-600 text-sm font-bold">FR</span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold">FRT-VMS</span>
              <span className="block text-[11px] text-slate-400">Public API reference</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2 text-xs font-medium sm:text-sm">
            <a
              href="/api/public/fuel"
              className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-200 hover:border-slate-500 hover:text-white"
            >
              Live JSON
            </a>
            <Link href="/dashboard" className="rounded-md bg-white px-3 py-1.5 text-slate-900 hover:bg-slate-100">
              Open app
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Documentation</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Open, read-only JSON for the FRT fleet — fuel consumption, mileage, distance and vehicle details. No login,
            no API key, no token.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {ENDPOINTS.map((endpoint) => (
              <a
                key={endpoint.path}
                href={endpoint.anchor}
                className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-400 hover:shadow"
              >
                <span className="inline-flex items-center gap-1.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  GET
                </span>
                <code className="mt-2 block break-all font-mono text-[13px] font-semibold text-slate-900">
                  {endpoint.path}
                </code>
                <span className="mt-1.5 block text-xs font-semibold text-slate-700">{endpoint.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">{endpoint.blurb}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Body: sticky contents + prose ── */}
      <div className="mx-auto flex max-w-6xl gap-10 px-4 py-10 sm:px-6">
        <nav aria-label="On this page" className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pb-8">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">On this page</p>
            <ul className="space-y-0.5 border-l border-slate-200">
              {headings.map((heading) => (
                <li key={heading.id}>
                  <a
                    href={`#${heading.id}`}
                    data-toc-link
                    className={`-ml-px block border-l-2 border-transparent py-1 text-[13px] leading-snug text-slate-500 transition hover:border-slate-400 hover:text-slate-900 data-[active]:border-blue-600 data-[active]:font-medium data-[active]:text-blue-700 ${
                      heading.level === 3 ? "pl-6" : "pl-3 font-medium text-slate-700"
                    }`}
                  >
                    {heading.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <main className="min-w-0 flex-1">
          {/* Mobile contents */}
          <details className="mb-8 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:hidden">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">On this page</summary>
            <ul className="mt-3 space-y-1.5">
              {headings.map((heading) => (
                <li key={heading.id} className={heading.level === 3 ? "pl-4" : ""}>
                  <a href={`#${heading.id}`} className="text-sm text-blue-700 hover:underline">
                    {heading.text}
                  </a>
                </li>
              ))}
            </ul>
          </details>

          <article className="doc-body" dangerouslySetInnerHTML={{ __html: html }} />

          <footer className="mt-16 border-t border-slate-200 pt-6 text-xs text-slate-500">
            <p>
              FRT Vehicle Management System · this page is rendered from <code>docs/public-api.md</code>, so it always
              matches the repo.
            </p>
          </footer>
        </main>
      </div>

      <DocEnhancements />
    </div>
  );
}

/**
 * Typography for the rendered markdown. Scoped under .doc-body so it can't leak
 * into the rest of the app, and kept here (rather than in Tailwind classes)
 * because the HTML is produced by the renderer, not by JSX.
 */
const DOC_STYLES = `
.doc-body { color:#334155; font-size:15px; line-height:1.7;
  font-family:var(--font-geist-sans),ui-sans-serif,system-ui,"Segoe UI",Roboto,Arial,sans-serif; }
.doc-body h2 { scroll-margin-top:6rem; margin:3rem 0 1rem; padding-bottom:.5rem; border-bottom:1px solid #e2e8f0;
  font-size:1.5rem; font-weight:700; letter-spacing:-.01em; color:#0f172a; }
.doc-body h3 { scroll-margin-top:6rem; margin:2.25rem 0 .75rem; font-size:1.125rem; font-weight:650; color:#0f172a; }
.doc-body h4 { scroll-margin-top:6rem; margin:1.75rem 0 .5rem; font-size:1rem; font-weight:650; color:#0f172a; }
.doc-body h2:first-child, .doc-body h3:first-child { margin-top:0; }
.doc-body p { margin:0 0 1rem; }
/* Tailwind's preflight clears list markers globally — restore them here. */
.doc-body ul { list-style:disc; }
.doc-body ol { list-style:decimal; }
.doc-body ul, .doc-body ol { margin:0 0 1.25rem; padding-left:1.35rem; }
.doc-body em { font-style:italic; }
.doc-body li { margin:.35rem 0; }
.doc-body li::marker { color:#94a3b8; }
.doc-body a { color:#1d4ed8; text-decoration:underline; text-underline-offset:2px; overflow-wrap:anywhere; }
.doc-body a:hover { color:#1e40af; }
.doc-body strong { color:#0f172a; font-weight:650; }
.doc-body hr { border:0; border-top:1px solid #e2e8f0; margin:3rem 0; }

/* Heading anchors — visible on hover, invisible in the reading flow otherwise. */
.doc-body .doc-anchor { float:left; margin-left:-1.1rem; padding-right:.35rem; color:#cbd5e1;
  text-decoration:none; opacity:0; transition:opacity .12s; }
.doc-body h2:hover .doc-anchor, .doc-body h3:hover .doc-anchor, .doc-body h4:hover .doc-anchor { opacity:1; }

.doc-body code { font-family:var(--font-geist-mono),ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:.86em; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:4px; padding:.1em .35em;
  color:#0f172a; overflow-wrap:anywhere; }

.doc-code { position:relative; margin:0 0 1.5rem; border-radius:10px; background:#0f172a; }
.doc-code pre { margin:0; padding:1rem 1.1rem; overflow-x:auto; }
.doc-code code { background:none; border:0; padding:0; color:#e2e8f0; font-size:13px; line-height:1.6; }
.doc-code-lang { position:absolute; top:.55rem; left:1.1rem; font-size:10px; font-weight:700;
  letter-spacing:.08em; text-transform:uppercase; color:#64748b; }
.doc-code:has(.doc-code-lang) pre { padding-top:2rem; }
.doc-copy { position:absolute; top:.45rem; right:.5rem; padding:.25rem .6rem; border-radius:6px;
  border:1px solid #334155; background:#1e293b; color:#cbd5e1; font-size:11px; font-weight:600; cursor:pointer; }
.doc-copy:hover { background:#334155; color:#fff; }

.doc-scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; }
.doc-body table { width:100%; border-collapse:collapse; margin:0 0 1.5rem; font-size:14px; }
.doc-body th, .doc-body td { text-align:left; padding:.6rem .8rem; border-bottom:1px solid #e2e8f0; vertical-align:top; }
.doc-body th { background:#f8fafc; font-weight:650; color:#0f172a; white-space:nowrap; }
.doc-body tbody tr:hover { background:#f8fafc; }
.doc-body td code { white-space:nowrap; }

.doc-body blockquote { margin:0 0 1.5rem; padding:.85rem 1rem; border-left:3px solid #3b82f6;
  border-radius:0 8px 8px 0; background:#eff6ff; color:#1e3a5f; }
.doc-body blockquote p { margin:0; }
`;
