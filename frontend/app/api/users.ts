import { apiCall } from "./client";
import type { User } from "~/types/auth";

export async function updateDisplayName(
  token: string,
  displayName: string
): Promise<User> {
  return apiCall("/api/users/me", token, {
    method: "PATCH",
    body: JSON.stringify({ display_name: displayName }),
  });
}

export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string
): Promise<{ message: string }> {
  return apiCall("/api/auth/change-password", token, {
    method: "POST",
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}
