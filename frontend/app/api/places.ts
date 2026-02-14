import { apiCall } from "./client";

export async function getPlacePhoto(
  token: string,
  placeId: string,
  photoReference: string
): Promise<string> {
  const params = new URLSearchParams({ photo_reference: photoReference });
  const data = await apiCall(
    `/api/places/${placeId}/photo?${params.toString()}`,
    token
  );
  return data.photo_url;
}
