import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import LocationPermissionSection from "~/components/LocationPermissionSection";

interface SetupOptions {
  userAgent: string;
  permissionState?: PermissionState;
  isStandalone?: boolean;
  permissionsUnsupported?: boolean;
}

function setupEnvironment({
  userAgent,
  permissionState = "prompt",
  isStandalone = false,
  permissionsUnsupported = false,
}: SetupOptions) {
  Object.defineProperty(window.navigator, "userAgent", {
    value: userAgent,
    configurable: true,
  });

  Object.defineProperty(window.navigator, "standalone", {
    value: isStandalone,
    configurable: true,
  });

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(display-mode: standalone)" ? isStandalone : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  if (permissionsUnsupported) {
    Object.defineProperty(window.navigator, "permissions", {
      value: undefined,
      configurable: true,
    });
    return;
  }

  const permissionStatus = {
    state: permissionState,
    onchange: null,
  } as PermissionStatus;

  Object.defineProperty(window.navigator, "permissions", {
    value: {
      query: vi.fn().mockResolvedValue(permissionStatus),
    },
    configurable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LocationPermissionSection", () => {
  test("許可済み状態で成功メッセージを表示する", async () => {
    setupEnvironment({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
      permissionState: "granted",
    });

    render(<LocationPermissionSection />);

    expect(
      await screen.findByText("許可済み — 現在地を使って提案しています"),
    ).toBeInTheDocument();
  });

  test("permissions API がない場合は unsupported メッセージを表示する", async () => {
    setupEnvironment({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
      permissionsUnsupported: true,
    });

    render(<LocationPermissionSection />);

    expect(
      await screen.findByText("このブラウザは位置情報に対応していません。"),
    ).toBeInTheDocument();
  });

  test("iOS Safari の prompt 状態で Safari 向け案内を表示する", async () => {
    setupEnvironment({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      permissionState: "prompt",
    });

    render(<LocationPermissionSection />);

    expect(
      await screen.findByText(
        (text) =>
          text.includes("Safari ウェブサイト") && text.includes("管理できます"),
      ),
    ).toBeInTheDocument();
  });

  test("iOS Chrome で拒否時は Chrome 用の変更手順を表示する", async () => {
    setupEnvironment({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1",
      permissionState: "denied",
    });

    render(<LocationPermissionSection />);

    expect(await screen.findByText("「Chrome」をタップ")).toBeInTheDocument();
  });

  test("iOS スタンドアロンで拒否時は Roamble 用の変更手順を表示する", async () => {
    setupEnvironment({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      permissionState: "denied",
      isStandalone: true,
    });

    render(<LocationPermissionSection />);

    expect(await screen.findByText("「Roamble」をタップ")).toBeInTheDocument();
  });

  test("Android で拒否時は Android 向け変更手順を表示する", async () => {
    setupEnvironment({
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
      permissionState: "denied",
    });

    render(<LocationPermissionSection />);

    expect(
      await screen.findByText("「サイトの設定」→「位置情報」"),
    ).toBeInTheDocument();
  });
});
