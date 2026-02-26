/**
 * バックエンドが返すエラーコード定数
 */
export const API_ERROR_CODES = {
  DAILY_LIMIT_REACHED: "DAILY_LIMIT_REACHED",
  NO_NEARBY_PLACES: "NO_NEARBY_PLACES",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

/**
 * 提案API用のユーザー向けメッセージ定数
 * DAILY_LIMIT_REACHED はコンプリートカードで表示するためここには含めない
 */
export const SUGGESTION_MESSAGES = {
  NO_NEARBY_PLACES: "近くのスポットが見つかりませんでした",
  FETCH_ERROR: "スポットの取得に失敗しました",
} as const;

/**
 * API エラーを表す型付きエラークラス
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * HTTP ステータスコードに対応するユーザー向けメッセージを返す
 */
export function getErrorMessage(status: number, fallback?: string): string {
  switch (status) {
    case 400:
      return "リクエストが不正です。入力内容を確認してください";
    case 401:
      return "認証の有効期限が切れました。再ログインしてください";
    case 403:
      return "この操作を行う権限がありません";
    case 404:
      return "リソースが見つかりませんでした";
    case 409:
      return "データが競合しています。内容を確認してください";
    case 429:
      return "リクエストが多すぎます。しばらく待ってからお試しください";
    case 500:
    case 502:
    case 503:
      return "サーバーエラーが発生しました。時間をおいて再度お試しください";
    default:
      return fallback ?? "予期しないエラーが発生しました";
  }
}

/**
 * fetch レスポンスから ApiError を生成する
 */
export async function parseApiError(res: Response): Promise<ApiError> {
  let message = getErrorMessage(res.status);
  let code: string | undefined;

  try {
    const body = await res.json();
    if (body.error) {
      message = body.error;
    }
    if (body.code) {
      code = body.code;
    }
  } catch {
    // JSON パース失敗時はデフォルトメッセージを使用
  }

  return new ApiError(res.status, message, code);
}

/**
 * エラーがネットワークエラー（オフライン等）かを判定する
 */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError && error.message === "Failed to fetch";
}

/**
 * エラーから表示用メッセージを取得する
 */
export function toUserMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (isNetworkError(error)) {
    return "ネットワークに接続できません。通信環境をご確認ください";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "予期しないエラーが発生しました";
}
