import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { IntlProvider } from "@/components/layout/intl-provider";
import { MultiSelect } from "@/components/ui/multi-select";
import he from "@/messages/he.json";

/**
 * The report filters were a native <select multiple>: picking a second department needed
 * Ctrl/Cmd, which nobody discovers. The control is a checkbox list with "select all" and
 * "clear", and an empty selection reads as "all" – the way every report treats an empty filter.
 */
function render(node: React.ReactNode) {
  return renderToString(
    <IntlProvider locale="he" dir="rtl" messages={he}>
      {node}
    </IntlProvider>,
  );
}

const OPTIONS = [
  { id: "a", name: "תנועה כבישים" },
  { id: "b", name: "GIS" },
  { id: "c", name: "תחבורה" },
];

describe("filter multi-select", () => {
  it("offers select-all and clear in Hebrew, and says 'all' while nothing is picked", () => {
    const html = render(<MultiSelect options={OPTIONS} value={[]} onChange={() => {}} />);
    expect(html).toContain("בחר הכל");
    expect(html).toContain("נקה");
    expect(html).toContain("הכל");
    for (const o of OPTIONS) expect(html).toContain(o.name);
  });

  it("counts the picked options instead", () => {
    const html = render(<MultiSelect options={OPTIONS} value={["a", "c"]} onChange={() => {}} />);
    expect(html).toContain("נבחרו 2");
  });

  it("checks exactly the picked options", () => {
    const html = render(<MultiSelect options={OPTIONS} value={["b"]} onChange={() => {}} />);
    expect(html.match(/checked=""/g) ?? []).toHaveLength(1);
  });

  it("shows a search box only once the list is long", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: String(i), name: `עובד ${i}` }));
    expect(render(<MultiSelect options={OPTIONS} value={[]} onChange={() => {}} />)).not.toContain('placeholder="חיפוש"');
    expect(render(<MultiSelect options={many} value={[]} onChange={() => {}} />)).toContain('placeholder="חיפוש"');
  });
});
