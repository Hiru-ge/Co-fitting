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
  photo_reference?: string;
  xp_earned: number;
  is_breakout: boolean;
  visited_at: string;
  created_at: string;
}

export interface UpdateVisitRequest {
  memo?: string | null;
  rating?: number | null;
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
  photo_reference?: string; // 画像参照（Redis TTL失効後の再解決に使用）
  place_types?: string[]; // バックエンドの is_breakout 自動判定に使用
  visited_at: string;
  user_lat?: number; // ユーザーの現在緯度（バックエンド距離検証用）
  user_lng?: number; // ユーザーの現在経度（バックエンド距離検証用）
}

// XP計算内訳
export interface XPBreakdown {
  base_xp: number; // ベースXP（通常50 or 脱却100）
  first_area_bonus: number; // 初エリアボーナス（0 or 30）
  streak_bonus: number; // ストリークボーナス（0〜100）
}

export interface BadgeInfo {
  id: number;
  name: string;
  description: string;
  icon_url: string;
}

// マップ表示用の訪問データ
export interface MapVisit {
  id: number;
  place_id: string;
  place_name: string;
  lat: number;
  lng: number;
  category: string;
  genre_tag_id?: number;
  visited_at: string;
}

export interface MapVisitResponse {
  visits: MapVisit[];
  total: number;
}

// バックエンドから返るゲーミフィケーションフィールドも含めた訪問作成レスポンス
export interface CreateVisitResponse extends Visit {
  total_xp: number;
  is_level_up: boolean;
  new_level: number;
  new_badges: BadgeInfo[];
  /** 今回の訪問で本日の3件上限に達したか（バックエンドの訪問履歴に基づく正確な判定） */
  is_daily_completed: boolean;
  /** XP計算内訳 */
  xp_breakdown: XPBreakdown;
}
