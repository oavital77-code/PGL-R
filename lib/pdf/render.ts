import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * HTML → PDF (spec §2.1): Playwright chromium. On Vercel uses @sparticuz/chromium with
 * playwright-core; locally uses the installed browser (PLAYWRIGHT chromium or CHROMIUM_PATH).
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const { chromium } = await import("playwright-core");
  let executablePath: string | undefined = process.env.CHROMIUM_PATH;
  let args: string[] = [];
  if (!executablePath && (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)) {
    const sparticuz = (await import("@sparticuz/chromium")).default;
    executablePath = await sparticuz.executablePath();
    args = sparticuz.args;
  }
  if (!executablePath) {
    const candidates = ["/opt/pw-browsers/chromium", ...fs.existsSync("/opt/pw-browsers") ? fs.readdirSync("/opt/pw-browsers").filter((d) => d.startsWith("chromium-")).map((d) => path.join("/opt/pw-browsers", d, "chrome-linux", "chrome")) : []];
    executablePath = candidates.find((c) => fs.existsSync(c));
  }
  const browser = await chromium.launch({ executablePath, args: [...args, "--no-sandbox", "--font-render-hinting=none"], headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<void> } }).fonts.ready);
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: "14mm", bottom: "18mm", left: "12mm", right: "12mm" }, displayHeaderFooter: false });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/** Base64 font for embedding (self-hosted, spec §2.1). */
export function fontDataUri(): string {
  const p = path.join(process.cwd(), "public", "fonts", "Assistant-Variable.ttf");
  if (!fs.existsSync(p)) return "";
  return `data:font/ttf;base64,${fs.readFileSync(p).toString("base64")}`;
}
