import { readFile } from "node:fs/promises";
import path from "node:path";

// PUBLIC, unauthenticated docs page for the /api/public endpoints.
// Whitelisted in middleware.ts (publicPaths "/api/public") so it bypasses the
// login gate — share https://frtvms.vercel.app/api/public/docs with anyone.
//
// It renders docs/public-api.md at request time so the page and the repo doc can
// never drift apart. next.config.mjs traces that .md file into this function.
// The renderer below only covers the constructs the doc actually uses (headings,
// tables, fenced code, bullet lists, links, bold, inline code) — it is not a
// general Markdown implementation, so keep the doc to those.
export const dynamic = "force-dynamic";

const DOC_PATH = path.join(process.cwd(), "docs", "public-api.md");

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Inline spans. Code spans are pulled out behind a %%CODE0%% placeholder before
 * anything else runs, so their contents stay literal while bold/links can still
 * wrap around them — e.g. **Only `status = "active"` vehicles**.
 */
function inline(text: string): string {
  const codes: string[] = [];
  const withPlaceholders = text.replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(code);
    return `%%CODE${codes.length - 1}%%`;
  });

  return escapeHtml(withPlaceholders)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, href: string) => `<a href="${href}">${label}</a>`)
    // Autolinks: <https://…> has survived escaping as &lt;https://…&gt;
    .replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (_, href: string) => `<a href="${href}">${href}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/%%CODE(\d+)%%/g, (_, index: string) => `<code>${escapeHtml(codes[Number(index)])}</code>`);
}

function renderTable(rows: string[]): string {
  const cells = (row: string) =>
    row
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());

  const [header, , ...body] = rows;
  const head = cells(header)
    .map((cell) => `<th>${inline(cell)}</th>`)
    .join("");
  const rest = body
    .map((row) => `<tr>${cells(row).map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`)
    .join("");

  return `<div class="scroll"><table><thead><tr>${head}</tr></thead><tbody>${rest}</tbody></table></div>`;
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    html.push(`<ul>${list.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
    list = [];
  };
  const flush = () => {
    flushParagraph();
    flushList();
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (line.startsWith("```")) {
      flush();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        code.push(lines[i]);
        i += 1;
      }
      html.push(`<pre class="scroll"><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    // A table is a pipe row followed by the |---|---| separator.
    if (line.startsWith("|") && /^\|[\s:|-]+\|$/.test(lines[i + 1] ?? "")) {
      flush();
      const rows: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        rows.push(lines[i]);
        i += 1;
      }
      i -= 1;
      html.push(renderTable(rows));
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flush();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      flush();
      html.push("<hr />");
      continue;
    }

    const item = line.match(/^[-*]\s+(.*)$/);
    if (item) {
      flushParagraph();
      list.push(item[1]);
      continue;
    }

    if (!line.trim()) {
      flush();
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flush();
  return html.join("\n");
}

const STYLES = `
:root { color-scheme: light dark; --bg:#ffffff; --fg:#1f2933; --muted:#6b7280; --line:#e5e7eb; --soft:#f9fafb; --accent:#1d4ed8; }
@media (prefers-color-scheme: dark) {
  :root { --bg:#0f172a; --fg:#e2e8f0; --muted:#94a3b8; --line:#1e293b; --soft:#111c33; --accent:#7dd3fc; }
}
* { box-sizing: border-box; }
body { margin:0; padding:2.5rem 1.25rem 4rem; background:var(--bg); color:var(--fg);
  font:16px/1.65 ui-sans-serif,system-ui,"Segoe UI",Roboto,Arial,sans-serif; }
main { max-width: 52rem; margin: 0 auto; }
h1 { font-size:1.9rem; line-height:1.25; margin:0 0 .5rem; letter-spacing:-.01em; }
h2 { font-size:1.3rem; margin:2.25rem 0 .75rem; padding-bottom:.4rem; border-bottom:1px solid var(--line); }
h3 { font-size:1.05rem; margin:1.75rem 0 .5rem; }
p, ul { margin:0 0 1rem; }
ul { padding-left:1.25rem; }
li { margin:.3rem 0; }
a { color:var(--accent); }
hr { border:0; border-top:1px solid var(--line); margin:2.5rem 0; }
code { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:.87em;
  background:var(--soft); border:1px solid var(--line); border-radius:4px; padding:.1em .35em; }
pre { background:var(--soft); border:1px solid var(--line); border-radius:8px; padding:.9rem 1rem; margin:0 0 1.25rem; }
pre code { background:none; border:0; padding:0; font-size:.85rem; line-height:1.55; }
.scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; }
table { width:100%; border-collapse:collapse; margin:0 0 1.25rem; font-size:.92rem; }
th, td { text-align:left; padding:.55rem .7rem; border-bottom:1px solid var(--line); vertical-align:top; }
th { background:var(--soft); font-weight:600; white-space:nowrap; }
footer { margin-top:3rem; padding-top:1rem; border-top:1px solid var(--line); color:var(--muted); font-size:.85rem; }
`;

export async function GET() {
  let markdown: string;
  try {
    markdown = await readFile(DOC_PATH, "utf8");
  } catch (error) {
    console.error("[api/public/docs] couldn't read docs/public-api.md:", error);
    return new Response("Documentation is unavailable.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>FRT VMS — Public API</title>
<meta name="description" content="Open, read-only JSON endpoints of the FRT Vehicle Management System." />
<style>${STYLES}</style>
</head>
<body>
<main>
${markdownToHtml(markdown)}
<footer>FRT Vehicle Management System · rendered from <code>docs/public-api.md</code></footer>
</main>
</body>
</html>`;

  return new Response(page, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
