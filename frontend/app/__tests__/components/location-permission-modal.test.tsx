import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LocationPermissionModal from "~/components/LocationPermissionModal";

describe("LocationPermissionModal", () => {
  test("ボトムナビ領域を除いた範囲で最前面表示される", () => {
    const onUseDefault = vi.fn();
    const onGoToSettings = vi.fn();

    const { container } = render(
      <LocationPermissionModal
        onUseDefault={onUseDefault}
        onGoToSettings={onGoToSettings}
      />,
    );

    const dialog = screen.getByRole("dialog", {
      name: "位置情報が利用できません",
    });
    expect(dialog).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("top-0", "bottom-16", "z-80");
  });

  test("各ボタン押下でコールバックが呼ばれる", async () => {
    const user = userEvent.setup();
    const onUseDefault = vi.fn();
    const onGoToSettings = vi.fn();

    render(
      <LocationPermissionModal
        onUseDefault={onUseDefault}
        onGoToSettings={onGoToSettings}
      />,
    );

    await user.click(screen.getByRole("button", { name: "設定で許可する" }));
    await user.click(screen.getByRole("button", { name: "渋谷駅周辺で試す" }));

    expect(onGoToSettings).toHaveBeenCalledTimes(1);
    expect(onUseDefault).toHaveBeenCalledTimes(1);
  });
});
