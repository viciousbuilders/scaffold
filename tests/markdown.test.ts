import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/ui/markdown";

const render = (text: string) => renderToStaticMarkup(createElement(Markdown, null, text));

describe("question Markdown", () => {
  it("renders Markdown tables and keeps code literal", () => {
    const html = render(
      "**Loss** with `y_pred`\n\n| Value | Result |\n| --- | --- |\n| MSE | 0.5 |\n\n```python\nexpression = '$x^2$'\n```",
    );
    expect(html).toContain("<strong>Loss</strong>");
    expect(html).toContain("<code>y_pred</code>");
    expect(html).toContain('class="markdown-table"');
    expect(html).toContain("<th>Value</th>");
    expect(html).toContain("$x^2$");
    expect(html).not.toContain('class="katex"');
  });

  it("renders inline and display LaTeX with accessible MathML", () => {
    const html = render(
      "The mean is $\\frac{4}{3}$.\n\n$$\n\\operatorname{MSE} = \\frac{1}{n} \\sum_{i=1}^{n} (\\hat{y}_i - y_i)^2\n$$",
    );
    expect(html).toContain('class="katex"');
    expect(html).toContain('class="katex-display"');
    expect(html).toContain("<math");
    expect(html).not.toContain("katex-error");
  });

  it("does not execute raw HTML or script links in question text", () => {
    const html = render("<script>alert(1)</script>\n\n[click](javascript:alert(1))");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('href="javascript:');
  });
});
