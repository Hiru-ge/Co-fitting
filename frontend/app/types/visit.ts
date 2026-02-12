export interface Visit {
  id: number;
  user_id: number;
  place_id: string;
  place_name: string;
  lat: number;
  lng: number;
  rating: number | null;
  memo: string | null;
  is_comfort_zone: boolean;
  visited_at: string;
  created_at: string;
}

export interface CreateVisitRequest {
  place_id: string;
  place_name: string;
  lat: number;
  lng: number;
  rating?: number;
  memo?: string;
  is_comfort_zone?: boolean;
  visited_at: string;
}
