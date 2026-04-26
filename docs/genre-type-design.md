# ジャンル・タイプ設計方針

施設タイプの変換ロジックはバックエンドに集約し、フロントは受け取った値を表示するだけとする。

## 把握しておくべき基本用語

| 用語 | 説明 |
|------|------|
| `Google Places APIの施設タイプ一覧(types)` | Google Places API が返す施設のタイプの配列。複数のタイプを持つことがある（例: `["restaurant", "point_of_interest", "establishment"]`） |
| `primaryType` | Google Places API が返す施設の具体タイプ（例: `sushi_restaurant`）。単一の値 |
| `display_type` | バックエンドで `primaryType` を抽象化して変換した表示用タイプ（例: `restaurant`）。フロントの `CATEGORY_MAP` のキーとして使用 |

## タイプの変換フロー

Google Places API が返す `primaryType`（例: `sushi_restaurant`）をバックエンドで2段変換して返す。

```
primaryType (Google API)
  → GetDisplayTypeFromPrimaryType → display_type → フロント CATEGORY_MAP でUI描画
                                                 → displayTypeToGenreName → ジャンル名（興味照合・XP判定）
```

`*_restaurant` や `*_bar` のサフィックスフォールバックにより、未収録の具体タイプも自動で抽象タイプに集約される。これにより `placeTypeToDisplayType` に個別エントリがなくても正しく処理できる。

## 各フィールドの責務

| フィールド | 値の例 | 用途 |
|------------|--------|------|
| `primary_type` | `sushi_restaurant` | Google APIのネイティブタイプ。バックエンドの `is_breakout` 自動判定に使用。訪問記録時にフロントから送信する |
| `display_type` | `restaurant` | バックエンドで変換した表示用抽象タイプ。フロントの `getCategoryInfo()` キーとして使う |

## バックエンド主要定数（`backend/services/suggestion.go`）

| 定数 | 役割 |
|------|------|
| `placeTypeToDisplayType` | `primaryType` → `display_type` の明示マッピング。`*_restaurant` / `*_bar` サフィックスのフォールバックつき |
| `VisitableTypes` | Google API の `includedTypes` に渡す抽象タイプ一覧。具体タイプを含めないことで50件制限に対応 |
| `displayTypeToGenreName` | `display_type` → 日本語ジャンル名。`genre_tags` テーブルの名称と一致させること |
| `AdultVenueTypes` | 成人向けフィルタ対象の `primaryType` 一覧。`display_type` ではなく `primaryType` で判定する |

## フロントエンド規約

- カテゴリ取得は `getCategoryInfo(place.display_type)` のみ使用し、`primary_type` を直接 `CATEGORY_MAP` のキーにしない
- `CATEGORY_MAP`（`app/lib/category-map.ts`）のキーは `display_type` の値域と一致させること
- `is_interest_match` / `is_breakout` はバックエンドで計算済み。フロントは受け取った値を表示するだけでよい

## ジャンルを追加するとき

1. `placeTypeToDisplayType` に `primaryType → display_type` のエントリを追加（サフィックスで自動集約できる場合は不要）
2. `VisitableTypes` に抽象タイプを追加（具体タイプは追加しない）
3. `displayTypeToGenreName` に `display_type → 日本語ジャンル名` を追加
4. フロントの `CATEGORY_MAP` に `display_type → CategoryInfo` を追加
5. DBの `genre_tags` テーブルに対応する日本語ジャンル名のレコードを追加
