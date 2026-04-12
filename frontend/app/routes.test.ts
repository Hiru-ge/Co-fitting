import { describe, test, expect } from "vitest";
import routes from "~/routes";

function flattenPaths(items: unknown[]): string[] {
  const out: string[] = [];
  for (const item of items as Array<Record<string, unknown>>) {
    if (typeof item.path === "string") {
      out.push(item.path);
    }
    if (Array.isArray(item.children)) {
      out.push(...flattenPaths(item.children));
    }
  }
  return out;
}

describe("ルート定義", () => {
  test("重要ルートが定義されている", () => {
    const paths = flattenPaths(routes as unknown as unknown[]);

    expect(paths).toContain("beta-gate");
    expect(paths).toContain("pwa-prompt");
    expect(paths).toContain("onboarding");
    expect(paths).toContain("privacy");
    expect(paths).toContain("summary/weekly");
    expect(paths).toContain("summary/monthly");
  });
});
