export interface Place {
  place_id: string;
  name: string;
  vicinity: string;
  lat: number;
  lng: number;
  rating: number;
  display_type: string;
  photo_reference?: string;
  /** 興味ジャンル設定時のみ含まれる: true=興味内, false=興味外, undefined=興味ジャンル未設定 */
  is_interest_match?: boolean;
  /** 熟練度ベースチャレンジ判定: true=チャレンジモード（熟練度Lv.1）, false=通常, undefined=判定不可 */
  is_breakout?: boolean;
  /** 現在の営業状況: true=営業中, false=閉店中, undefined=情報なし（公園など24h施設）*/
  is_open_now?: boolean;
}

export interface SuggestionResult {
  places: Place[];
  notice?: string;
  is_completed?: boolean;
  reload_count_remaining?: number;
}
