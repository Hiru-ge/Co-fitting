export interface Place {
  place_id: string;
  name: string;
  vicinity: string;
  lat: number;
  lng: number;
  rating: number;
  types: string[];
  photo_reference?: string;
  /** 興味タグ設定時のみ含まれる: true=興味内, false=興味外, undefined=興味タグ未設定 */
  is_interest_match?: boolean;
  /** 熟練度ベース脱却判定: true=脱却モード（熟練度Lv.1）, false=通常, undefined=判定不可 */
  is_comfort_zone?: boolean;
}
