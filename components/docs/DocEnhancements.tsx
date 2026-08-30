"use client";

import { useEffect } from "react";

/**
 * Progressive enhancement for the /api-docs page. The document itself is fully
 * server-rendered and readable without JS; this only adds two conveniences:
 *
 *   1. a Copy button on every fenced code block
 *   2. the sidebar link for the section currently on screen gets highlighted
 *
 * It works on the server-rendered DOM rather than owning it, so the markdown
 * renderer stays the single source of the page's structure.
 */
export function DocEnhancements() {
  useEffect(() => {
    const blocks = Array.from(document.querySelectorAll<HTMLElement>(".doc-code"));
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const block of blocks) {
      if (block.querySelector(".doc-copy")) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "doc-copy";
      button.textContent = "Copy";
      button.addEventListener("click", () => {
        const code = block.querySelector("code")?.textContent ?? "";
        navigator.clipboard?.writeText(code).then(
          () => {
            button.textContent = "Copied";
            timers.push(setTimeout(() => (button.textContent = "Copy"), 1600));
          },
          () => {
            button.textContent = "Press Ctrl+C";
            timers.push(setTimeout(() => (button.textContent = "Copy"), 1600));
          },
        );
      });
      block.appendChild(button);
    }

    // Active-section highlight. rootMargin pins the "current" heading near the top
    // of the viewport so a section is marked read only once it actually leads.
    const links = new Map<string, HTMLAnchorElement>();
    for (const link of Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-toc-link]"))) {
      links.set(link.getAttribute("href")?.slice(1) ?? "", link);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          for (const link of Array.from(links.values())) link.removeAttribute("data-active");
          links.get(entry.target.id)?.setAttribute("data-active", "true");
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );

    for (const id of Array.from(links.keys())) {
      const heading = document.getElementById(id);
      if (heading) observer.observe(heading);
    }

    return () => {
      observer.disconnect();
      for (const timer of timers) clearTimeout(timer);
      for (const block of blocks) block.querySelector(".doc-copy")?.remove();
    };
  }, []);

  return null;
}
