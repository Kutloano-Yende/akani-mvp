export type TemplateVars = { firstName: string; companyName: string };

// Only the placeholders the template editor documents are filled; any other
// {{token}} renders as empty so a typo never reaches a recipient as raw text.
export function renderTemplate(text: string, vars: TemplateVars) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    if (key === "firstName") return vars.firstName;
    if (key === "companyName") return vars.companyName;
    return "";
  });
}

// Subjects go into a header — a stray newline in a company name must not be
// able to add headers.
export function renderSubject(text: string, vars: TemplateVars) {
  return renderTemplate(text, vars).replace(/[\r\n]+/g, " ").trim();
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function textToHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}
