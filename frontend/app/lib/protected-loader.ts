import { redirect } from "react-router";
import { getToken, getUser } from "./auth";

export async function protectedLoader() {
  const token = getToken();
  if (!token) {
    throw redirect("/login");
  }
  try {
    const user = await getUser(token);
    return { user, token };
  } catch {
    throw redirect("/login");
  }
}
