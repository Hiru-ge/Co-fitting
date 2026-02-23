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

export async function updateEmail(
  token: string,
  newEmail: string,
  currentPassword: string
): Promise<{ message: string }> {
  return apiCall("/api/users/me/email", token, {
    method: "PATCH",
    body: JSON.stringify({
      new_email: newEmail,
      current_password: currentPassword,
    }),
  });
}

export async function deleteAccount(token: string): Promise<void> {
  await apiCall("/api/users/me", token, {
    method: "DELETE",
  });
}
