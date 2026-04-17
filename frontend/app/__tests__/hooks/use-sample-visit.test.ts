import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSampleVisit } from "~/hooks/use-sample-visit";

describe("useSampleVisit", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test("初期状態ではサンプル訪問未完了", () => {
    const { result } = renderHook(() => useSampleVisit());
    expect(result.current.isCompleted).toBe(false);
    expect(result.current.isShowingXpModal).toBe(false);
  });

  test("completeSampleVisit でXPモーダルが表示される", () => {
    const { result } = renderHook(() => useSampleVisit());
    act(() => result.current.completeSampleVisit());
    expect(result.current.isCompleted).toBe(true);
    expect(result.current.isShowingXpModal).toBe(true);
  });

  test("サンプル訪問完了時にAPIが呼び出されない（履歴非反映）", () => {
    const { result } = renderHook(() => useSampleVisit());
    act(() => result.current.completeSampleVisit());
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("疑似XPデータが正しい値を持つ", () => {
    const { result } = renderHook(() => useSampleVisit());
    expect(result.current.pseudoXpData.xpEarned).toBe(50);
    expect(result.current.pseudoXpData.totalXp).toBe(50);
    expect(result.current.pseudoXpData.currentLevel).toBe(1);
    expect(result.current.pseudoXpData.isLevelUp).toBe(false);
  });

  test("closeXpModal でXPモーダルが閉じるが完了状態は維持される", () => {
    const { result } = renderHook(() => useSampleVisit());
    act(() => result.current.completeSampleVisit());
    expect(result.current.isShowingXpModal).toBe(true);
    act(() => result.current.closeXpModal());
    expect(result.current.isShowingXpModal).toBe(false);
    expect(result.current.isCompleted).toBe(true);
  });
});
