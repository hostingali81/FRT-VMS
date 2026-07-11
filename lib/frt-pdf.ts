import type { Browser } from "puppeteer-core";

// Renders the FRT directory HTML to an A4-landscape PDF via headless Chrome.
// On Vercel/AWS it uses @sparticuz/chromium; locally (or any host with Chrome)
// it uses the installed browser — set CHROME_EXECUTABLE_PATH to override.

function localChromePath(): string {
  if (process.env.CHROME_EXECUTABLE_PATH) return process.env.CHROME_EXECUTABLE_PATH;
  if (process.platform === "win32") return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (process.platform === "darwin") return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  return "/usr/bin/google-chrome";
}

async function launch(): Promise<Browser> {
  const puppeteer = await import("puppeteer-core");
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION);

  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  return puppeteer.launch({
    executablePath: localChromePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

export async function renderFrtPdf(html: string): Promise<Buffer> {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "6mm", right: "6mm", bottom: "6mm", left: "6mm" },
      preferCSSPageSize: false,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
