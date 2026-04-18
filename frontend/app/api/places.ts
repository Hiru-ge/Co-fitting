import { apiCall } from "./client";

export async function snoozePlace(
  authToken: string,
  placeId: string,
  days: number,
): Promise<void> {
  await apiCall(`/api/places/${placeId}/snooze?days=${days}`, authToken, {
    method: "POST",
  });
}

export async function getPlacePhoto(
  authToken: string,
  placeId: string,
  photoReference: string,
): Promise<string> {
  const path = `/api/places/${placeId}/photo?${new URLSearchParams({ photo_reference: photoReference }).toString()}`;
  const data = await apiCall(path, authToken);
  return data.photo_url;
}
