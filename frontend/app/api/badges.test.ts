import { describe, test, expect, vi } from "vitest";

vi.mock("~/api/client", () => ({
  apiCall: vi.fn(),
}));

import { apiCall } from "~/api/client";
import { getAllBadges } from "~/api/badges";

describe("badges api", () => {
  test("getAllBadgesは/api/badgesを呼ぶ", async () => {
    vi.mocked(apiCall).mockResolvedValueOnce([{ id: 1, name: "最初の一歩" }]);

    const result = await getAllBadges("token-1");

    expect(apiCall).toHaveBeenCalledWith("/api/badges", "token-1");
    expect(result).toEqual([{ id: 1, name: "最初の一歩" }]);
  });
});
