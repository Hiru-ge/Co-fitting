import { useEffect } from "react";
import { useRouteError, useNavigate } from "react-router";
import { useToast } from "~/components/Toast";
import { ApiError } from "~/utils/error";

/**
 * clientLoader がエラーを throw したときに表示される共通エラー境界。
 * トーストでメッセージを表示し、ホーム画面に遷移する。
 * ToastProvider の内側でレンダリングされるため useToast が使用可能。
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    const message =
      error instanceof ApiError
        ? error.message
        : "予期しないエラーが発生しました";
    showToast(message, "error");
    navigate(-1);
  }, [error, navigate, showToast]);

  return null;
}
