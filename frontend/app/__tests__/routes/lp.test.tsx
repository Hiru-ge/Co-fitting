import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

vi.mock("~/lib/gtag", () => ({
  sendIosNotifySubmitted: vi.fn(),
  sendLpCtaClicked: vi.fn(),
  sendLpSectionViewed: vi.fn(),
}));

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

describe("LP（日本語版）", () => {
  describe("clientLoader", () => {
    beforeEach(() => {
      vi.stubGlobal("navigator", { language: "ja" });
    });

    test("ブラウザ言語が ja のとき null を返す", async () => {
      const { clientLoader } = await import("~/routes/lp");
      const result = await clientLoader();
      expect(result).toBeNull();
    });

    test("ブラウザ言語が en のとき /lp/en にリダイレクトする", async () => {
      vi.stubGlobal("navigator", { language: "en-US" });
      const { clientLoader } = await import("~/routes/lp");

      try {
        await clientLoader();
        expect.fail("redirect がスローされるべき");
      } catch (response) {
        expect(response).toBeInstanceOf(Response);
        const res = response as Response;
        expect(res.status).toBe(302);
        expect(res.headers.get("Location")).toBe("/lp/en");
      }
    });

    test("ブラウザ言語が en-GB のとき /lp/en にリダイレクトする", async () => {
      vi.stubGlobal("navigator", { language: "en-GB" });
      const { clientLoader } = await import("~/routes/lp");

      try {
        await clientLoader();
        expect.fail("redirect がスローされるべき");
      } catch (response) {
        expect(response).toBeInstanceOf(Response);
        const res = response as Response;
        expect(res.status).toBe(302);
        expect(res.headers.get("Location")).toBe("/lp/en");
      }
    });
  });

  describe("レンダリング", () => {
    test("ヒーローの日本語キャッチコピーが表示される", async () => {
      const { default: LP } = await import("~/routes/lp");
      render(
        <MemoryRouter>
          <LP />
        </MemoryRouter>,
      );

      expect(
        screen.getByText("「いつも同じ店」を抜け出そう"),
      ).toBeInTheDocument();
    });

    test("日本語のペインポイント見出しが表示される", async () => {
      const { default: LP } = await import("~/routes/lp");
      render(
        <MemoryRouter>
          <LP />
        </MemoryRouter>,
      );

      expect(
        screen.getByText("こんな経験、ありませんか？"),
      ).toBeInTheDocument();
    });

    test("iOS通知セクションの日本語見出しが表示される", async () => {
      const { default: LP } = await import("~/routes/lp");
      render(
        <MemoryRouter>
          <LP />
        </MemoryRouter>,
      );

      expect(
        screen.getByRole("heading", { name: "iOS版リリース通知を受け取る" }),
      ).toBeInTheDocument();
    });

    test("「さっそく始める」CTAリンクが /beta-gate を指している", async () => {
      const { default: LP } = await import("~/routes/lp");
      render(
        <MemoryRouter>
          <LP />
        </MemoryRouter>,
      );

      const links = screen.getAllByRole("link", { name: "さっそく始める" });
      expect(links.length).toBeGreaterThan(0);
      links.forEach((link) => {
        expect(link).toHaveAttribute("href", "/beta-gate");
      });
    });
  });
});

describe("LP（英語版）", () => {
  describe("レンダリング", () => {
    test("ヒーローの英語キャッチコピーが表示される", async () => {
      const { default: LPEn } = await import("~/routes/lp-en");
      render(
        <MemoryRouter>
          <LPEn />
        </MemoryRouter>,
      );

      expect(
        screen.getByText("Break free from your usual spots"),
      ).toBeInTheDocument();
    });

    test("英語のペインポイント見出しが表示される", async () => {
      const { default: LPEn } = await import("~/routes/lp-en");
      render(
        <MemoryRouter>
          <LPEn />
        </MemoryRouter>,
      );

      expect(screen.getByText("Sound familiar?")).toBeInTheDocument();
    });

    test("iOS通知セクションの英語見出しが表示される", async () => {
      const { default: LPEn } = await import("~/routes/lp-en");
      render(
        <MemoryRouter>
          <LPEn />
        </MemoryRouter>,
      );

      expect(
        screen.getByText("Get notified when iOS launches"),
      ).toBeInTheDocument();
    });

    test("「Get started」CTAリンクが /beta-gate を指している", async () => {
      const { default: LPEn } = await import("~/routes/lp-en");
      render(
        <MemoryRouter>
          <LPEn />
        </MemoryRouter>,
      );

      const links = screen.getAllByRole("link", { name: "Get started" });
      expect(links.length).toBeGreaterThan(0);
      links.forEach((link) => {
        expect(link).toHaveAttribute("href", "/beta-gate");
      });
    });

    test("日本語テキストが混入していない", async () => {
      const { default: LPEn } = await import("~/routes/lp-en");
      render(
        <MemoryRouter>
          <LPEn />
        </MemoryRouter>,
      );

      expect(
        screen.queryByText("「いつも同じ店」を抜け出そう"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("こんな経験、ありませんか？"),
      ).not.toBeInTheDocument();
    });
  });
});
