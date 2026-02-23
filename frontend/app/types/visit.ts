export interface Visit {
  id: number;
  user_id: number;
  place_id: string;
  place_name: string;
  vicinity: string;
  category: string;
  lat: number;
  lng: number;
  rating: number | null;
  memo: string | null;
  is_comfort_zone: boolean;
  visited_at: string;
  created_at: string;
}

export interface VisitListResponse {
  visits: Visit[];
  total: number;
}

export interface CreateVisitRequest {
  place_id: string;
  place_name: string;
  vicinity?: string;
  category: string;
  lat: number;
  lng: number;
  rating?: number;
  memo?: string;
  is_comfort_zone?: boolean;
  visited_at: string;
}

export interface BadgeInfo {
  id: number;
  name: string;
  description: string;
  icon_url: string;
}

// Issue #128 実装後にバックエンドから返るゲーミフィケーションフィールド
export interface CreateVisitResponse extends Visit {
  xp_earned?: number;
  total_xp?: number;
  level_up?: boolean;
  new_level?: number;
  new_badges?: BadgeInfo[];
}
