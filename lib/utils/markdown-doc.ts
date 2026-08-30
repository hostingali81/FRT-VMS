// Minimal Markdown → HTML renderer for the public API documentation.
//
// It only covers the constructs docs/public-api.md actually uses — headings,
// tables, fenced code, bullet/ordered lists, blockquote callouts, links, bold and
// inline code — so it stays small and auditable. It is NOT a general Markdown
// implementation; keep the doc to those constructs.
//
// Rendering the checked-in .md at request time (rather than duplicating the copy
// in JSX) means the repo doc and the /api-docs page can never drift apart.

export type DocHeading = {
  id: string;
  text: string;
  level: number;
};

export type RenderedDoc = {
  html: string;
  /** h2/h3 headings, in document order — the sidebar table of contents. */
  headings: DocHeading[];
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** "GET /api/public/fuel" → "get-api-public-fuel" — stable, URL-safe anchor ids. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
    // Bold has already been consumed, so a lone pair of asterisks is emphasis.
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/%%CODE(\d+)%%/g, (_, index: string) => `<code>${escapeHtml(codes[Number(index)])}</code>`);
}

/** Strip inline markers so a heading's TOC label reads as plain text. */
const plainText = (text: string) =>
  text.replace(/`/g, "").replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

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

  return `<div class="doc-scroll"><table><thead><tr>${head}</tr></thead><tbody>${rest}</tbody></table></div>`;
}

export function renderMarkdownDoc(markdown: string): RenderedDoc {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  const headings: DocHeading[] = [];
  const seenIds = new Map<string, number>();

  let paragraph: string[] = [];
  let bullets: string[] = [];
  let numbered: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushBullets = () => {
    if (!bullets.length) return;
    html.push(`<ul>${bullets.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
    bullets = [];
  };
  const flushNumbered = () => {
    if (!numbered.length) return;
    html.push(`<ol>${numbered.map((item) => `<li>${inline(item)}</li>`).join("")}</ol>`);
    numbered = [];
  };
  const flush = () => {
    flushParagraph();
    flushBullets();
    flushNumbered();
  };

  /** Unique id per heading, so two "Response" sections don't collide. */
  const uniqueId = (text: string) => {
    const base = slugify(text) || "section";
    const count = seenIds.get(base) ?? 0;
    seenIds.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    // Fenced code block, with the language kept as a class for the copy widget.
    if (line.startsWith("```")) {
      flush();
      const language = line.slice(3).trim().toLowerCase();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        code.push(lines[i]);
        i += 1;
      }
      const label = language ? `<span class="doc-code-lang">${escapeHtml(language)}</span>` : "";
      html.push(
        `<div class="doc-code">${label}<pre class="doc-scroll"><code>${escapeHtml(code.join("\n"))}</code></pre></div>`,
      );
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
      const text = heading[2];
      const id = uniqueId(plainText(text));
      if (level === 2 || level === 3) headings.push({ id, text: plainText(text), level });
      html.push(
        `<h${level} id="${id}"><a class="doc-anchor" href="#${id}" aria-label="Link to this section">#</a>${inline(text)}</h${level}>`,
      );
      continue;
    }

    // Blockquote → callout box. Consecutive > lines fold into one.
    if (line.startsWith(">")) {
      flush();
      const quoted: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quoted.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      i -= 1;
      html.push(`<blockquote>${inline(quoted.join(" "))}</blockquote>`);
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      flush();
      html.push("<hr />");
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      flushNumbered();
      bullets.push(bullet[1]);
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.*)$/);
    if (ordered) {
      flushParagraph();
      flushBullets();
      numbered.push(ordered[1]);
      continue;
    }

    if (!line.trim()) {
      flush();
      continue;
    }

    flushBullets();
    flushNumbered();
    paragraph.push(line.trim());
  }

  flush();
  return { html: html.join("\n"), headings };
}
