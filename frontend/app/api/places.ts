import { apiCall } from "./client";

export async function getPlacePhoto(
  token: string,
  placeId: string,
  photoReference: string,
): Promise<string> {
  const path = `/api/places/${placeId}/photo?${new URLSearchParams({ photo_reference: photoReference }).toString()}`;
  const data = await apiCall(path, token);
  return data.photo_url;
}
