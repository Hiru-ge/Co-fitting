export interface Place {
  place_id: string;
  name: string;
  vicinity: string;
  lat: number;
  lng: number;
  rating: number;
  types: string[];
  photo_reference?: string;
  is_interest_match?: boolean;
}
