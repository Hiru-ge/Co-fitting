import { describe, test, expect } from "vitest";
import {
  ApiError,
  getErrorMessage,
  getErrorMessageByCustomCode,
  parseApiError,
  isNetworkError,
  toUserMessage,
} from "~/utils/error";

describe("ApiError", () => {
  test("status, message, code を保持する", () => {
    const err = new ApiError(404, "見つかりません", "NOT_FOUND");
    expect(err.status).toBe(404);
    expect(err.message).toBe("見つかりません");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.name).toBe("ApiError");
  });

  test("code は省略可能", () => {
    const err = new ApiError(500, "サーバーエラー");
    expect(err.code).toBeUndefined();
  });

  test("Error を継承している", () => {
    const err = new ApiError(401, "認証エラー");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
  });
});

describe("getErrorMessage", () => {
  test.each([
    [400, "リクエストが不正です"],
    [401, "認証の有効期限が切れました"],
    [403, "権限がありません"],
    [404, "見つかりませんでした"],
    [409, "競合しています"],
    [429, "リクエストが多すぎます"],
    [500, "サーバーエラー"],
    [502, "サーバーエラー"],
    [503, "サーバーエラー"],
  ])(
    "ステータス %i に対応するメッセージを返す",
    (status, expectedSubstring) => {
      const msg = getErrorMessage(status);
      expect(msg).toContain(expectedSubstring);
    },
  );

  test("未知のステータスにはデフォルトメッセージを返す", () => {
    expect(getErrorMessage(418)).toBe("予期しないエラーが発生しました");
  });

  test("未知のステータスに fallback を指定できる", () => {
    expect(getErrorMessage(418, "カスタムメッセージ")).toBe(
      "カスタムメッセージ",
    );
  });
});

describe("isNetworkError", () => {
  test("Failed to fetch の TypeError なら true", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
  });

  test("その他の TypeError なら false", () => {
    expect(isNetworkError(new TypeError("other error"))).toBe(false);
  });

  test("TypeError でない Error なら false", () => {
    expect(isNetworkError(new Error("Failed to fetch"))).toBe(false);
  });

  test("null / undefined なら false", () => {
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });
});

describe("getErrorMessageByCustomCode", () => {
  test("DAILY_LIMIT_REACHED に対応する日本語メッセージを返す", () => {
    expect(getErrorMessageByCustomCode("DAILY_LIMIT_REACHED")).toContain(
      "訪問上限",
    );
  });

  test("RELOAD_LIMIT_REACHED に対応する日本語メッセージを返す", () => {
    expect(getErrorMessageByCustomCode("RELOAD_LIMIT_REACHED")).toContain(
      "リロード",
    );
  });

  test("INVALID_REQUEST に対応する日本語メッセージを返す", () => {
    expect(getErrorMessageByCustomCode("INVALID_REQUEST")).toContain(
      "形式が正しく",
    );
  });

  test("INVALID_COORDINATES に対応する日本語メッセージを返す", () => {
    expect(getErrorMessageByCustomCode("INVALID_COORDINATES")).toContain(
      "座標",
    );
  });

  test("NO_NEARBY_PLACES に対応する日本語メッセージを返す", () => {
    expect(getErrorMessageByCustomCode("NO_NEARBY_PLACES")).toContain("お店");
  });

  test("NO_INTEREST_PLACES に対応する日本語メッセージを返す", () => {
    expect(getErrorMessageByCustomCode("NO_INTEREST_PLACES")).toContain(
      "興味ジャンル",
    );
  });

  test("ALL_VISITED_NEARBY に対応する日本語メッセージを返す", () => {
    expect(getErrorMessageByCustomCode("ALL_VISITED_NEARBY")).toContain(
      "訪問済み",
    );
  });

  test("未知の code には undefined を返す", () => {
    expect(getErrorMessageByCustomCode("UNKNOWN_CODE")).toBeUndefined();
  });
});

describe("parseApiError", () => {
  test("code がある場合は getErrorMessageByCustomCode の日本語メッセージを使う", async () => {
    const mockRes = {
      status: 429,
      json: async () => ({
        error: "daily visit limit reached",
        code: "DAILY_LIMIT_REACHED",
      }),
    } as Response;
    const err = await parseApiError(mockRes);
    expect(err.status).toBe(429);
    expect(err.code).toBe("DAILY_LIMIT_REACHED");
    expect(err.message).toContain("訪問上限");
  });

  test("code がない場合は HTTP ステータスに基づく日本語メッセージを使う", async () => {
    const mockRes = {
      status: 400,
      json: async () => ({ error: "invalid request body" }),
    } as Response;
    const err = await parseApiError(mockRes);
    expect(err.status).toBe(400);
    expect(err.code).toBeUndefined();
    expect(err.message).toContain("リクエストが不正");
  });

  test("JSON パース失敗時はステータスに基づく日本語メッセージを使う", async () => {
    const mockRes = {
      status: 500,
      json: async () => {
        throw new Error("parse error");
      },
    } as unknown as Response;
    const err = await parseApiError(mockRes);
    expect(err.status).toBe(500);
    expect(err.message).toContain("サーバーエラー");
  });
});

describe("toUserMessage", () => {
  test("ApiError からメッセージを取得する", () => {
    const err = new ApiError(500, "サーバーに問題が発生");
    expect(toUserMessage(err)).toBe("サーバーに問題が発生");
  });

  test("ネットワークエラーの場合は接続エラーメッセージ", () => {
    const err = new TypeError("Failed to fetch");
    expect(toUserMessage(err)).toContain("ネットワーク");
  });

  test("server_error の Error はサーバーエラーメッセージに変換する", () => {
    const err = new Error("server_error");
    expect(toUserMessage(err)).toContain("サーバーエラー");
  });

  test("通常の Error からメッセージを取得する", () => {
    const err = new Error("何かのエラー");
    expect(toUserMessage(err)).toBe("何かのエラー");
  });

  test("不明な型にはデフォルトメッセージ", () => {
    expect(toUserMessage("文字列エラー")).toBe(
      "予期しないエラーが発生しました",
    );
  });
});
