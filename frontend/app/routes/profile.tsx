import { redirect } from "react-router";
import { getToken } from "~/lib/auth";

export async function clientLoader() {
  const token = getToken();
  if (!token) {
    return redirect("/login");
  }
  return null;
}

export default function Profile() {
  return (
    <div className="flex items-center justify-center flex-1">
      <p className="text-gray-400">マイページ（準備中）</p>
    </div>
  );
}
