import { describe, expect, it } from "vitest";
import he from "@/messages/he.json";
import en from "@/messages/en.json";

/**
 * next-intl reads a dot inside a message key as nesting, so a flat "invoices.view" entry can
 * never be found: the screen falls back to the last segment and shows "view" in an otherwise
 * Hebrew page. That is what the report list, the permissions screen and the notification
 * settings did until 20/09/2026. Keys are nested, and the two bundles carry the same tree.
 */
type Tree = { [k: string]: string | Tree };

function paths(node: Tree, prefix = ""): string[] {
  return Object.entries(node).flatMap(([k, v]) => {
    const here = prefix ? `${prefix}.${k}` : k;
    return typeof v === "string" ? [here] : paths(v, here);
  });
}

function dottedKeys(node: Tree, prefix = ""): string[] {
  return Object.entries(node).flatMap(([k, v]) => {
    const here = prefix ? `${prefix}.${k}` : k;
    const bad = k.includes(".") ? [here] : [];
    return typeof v === "string" ? bad : [...bad, ...dottedKeys(v, here)];
  });
}

const HE = he as unknown as Tree;
const EN = en as unknown as Tree;

describe("message bundles", () => {
  it("carry a meaningful number of messages", () => {
    expect(paths(HE).length).toBeGreaterThan(500);
  });

  it.each([
    ["he", HE],
    ["en", EN],
  ])("hold no key with a dot in %s", (_locale, tree) => {
    expect(dottedKeys(tree)).toEqual([]);
  });

  it("describe the same keys in both languages", () => {
    const h = new Set(paths(HE));
    const e = new Set(paths(EN));
    expect([...h].filter((k) => !e.has(k))).toEqual([]);
    expect([...e].filter((k) => !h.has(k))).toEqual([]);
  });
});
