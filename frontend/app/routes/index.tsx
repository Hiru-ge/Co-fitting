import { Link, Form, redirect } from "react-router";
import { logout } from "~/lib/auth";

export async function clientAction() {
  await logout();
  return redirect("/login");
}

export default function Index() {
  return (
    <>
      <div>
        <h1>Roamble</h1>
        <p>コンフォートゾーンを超えよう</p>
        <Link to="/signup">サインアップ</Link>
        <Link to="/login">ログイン</Link>
      </div>
      <Form method="post">
        <button type="submit">ログアウト</button>
      </Form>
    </>
  );
}
