import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The interface is mirrored for Hebrew, so layout must be written in logical terms:
 * start/end (ps-, me-, text-start, rounded-s, border-e, start-0 …) and never in physical
 * left/right terms, which stay put when the page flips. A line that must be physical for a
 * real reason (an LTR-only widget) is marked with the comment `rtl-ok`.
 */
const PHYSICAL = /(?:^|[\s"'`{])(?:-?(?:ml|mr|pl|pr|left|right|scroll-ml|scroll-mr)-[\w\[\]/.%-]+|text-left|text-right|rounded-(?:l|r|tl|tr|bl|br)(?:-[\w]+)?|border-(?:l|r)(?:-[\w]+)?|float-left|float-right|clear-left|clear-right)(?=[\s"'`}]|$)/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe("no physical left/right layout classes in the UI", () => {
  const files = [...walk("app"), ...walk("components")];
  it("scans a meaningful number of files", () => {
    expect(files.length).toBeGreaterThan(50);
  });
  it("finds none (mark a deliberate exception with `rtl-ok`)", () => {
    const offenders: string[] = [];
    for (const f of files) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (/className|class=/.test(line) && !line.includes("rtl-ok") && PHYSICAL.test(line)) offenders.push(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
