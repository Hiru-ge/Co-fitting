export interface Place {
  place_id: string;
  name: string;
  vicinity: string;
  lat: number;
  lng: number;
  rating: number;
  types: string[];
  photo_reference?: string;
  /** 興味タグ設定時のみ含まれる: true=興味内, false=興味外(脱却モード), undefined=興味タグ未設定 */
  is_interest_match?: boolean;
}
