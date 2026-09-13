/** Placeholder rendering for e-mail templates (spec §6.2 step 2). */
export function renderTemplate(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => {
    const v = vars[key];
    return v === null || v === undefined ? "" : String(v);
  });
}

export function textToHtml(text: string): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div dir="rtl" style="font-family:Assistant,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111827;white-space:pre-wrap">${esc}</div>`;
}
