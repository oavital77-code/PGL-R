import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { IntlProvider } from "@/components/layout/intl-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Radix primitives stamp their own `dir` and default to "ltr" whatever <html dir> says.
 * The root layout's IntlProvider must hand them the page direction, otherwise every tab
 * strip – and every table inside a tab panel – lays out left-to-right.
 */
function tabs() {
  return (
    <Tabs defaultValue="lines">
      <TabsList>
        <TabsTrigger value="lines">שורות</TabsTrigger>
        <TabsTrigger value="details">פרטי חשבון</TabsTrigger>
      </TabsList>
      <TabsContent value="lines">
        <table>
          <tbody>
            <tr>
              <td>שלב</td>
            </tr>
          </tbody>
        </table>
      </TabsContent>
    </Tabs>
  );
}

describe("text direction reaches Radix primitives", () => {
  it("without the provider Radix lays tabs out left-to-right (the bug)", () => {
    const html = renderToString(tabs());
    expect(html).toContain('dir="ltr"');
    expect(html).not.toContain('dir="rtl"');
  });

  it("inside the root provider every Radix root carries dir=rtl", () => {
    const html = renderToString(
      <IntlProvider locale="he" dir="rtl" messages={{}}>
        {tabs()}
      </IntlProvider>,
    );
    expect(html).not.toContain('dir="ltr"');
    expect(html).toContain('dir="rtl"');
  });

  it("and dir=ltr for the English locale", () => {
    const html = renderToString(
      <IntlProvider locale="en" dir="ltr" messages={{}}>
        {tabs()}
      </IntlProvider>,
    );
    expect(html).not.toContain('dir="rtl"');
  });
});
