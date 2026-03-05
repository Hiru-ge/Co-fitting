# リファクタリング計画：コメント削除後の構造改善

コメント削除後、意味のまとまりが失われた箇所を関数・変数への切り出しで表現する。

---

## 1. `backend/main.go` — ハンドラー初期化の分離

### 問題
`main()` が「DB/Redis/JWT初期化」「オプションハンドラー初期化」「ルーター起動」を混在して担っており、1関数が長すぎる。コメントで区切っていた意図が失われた。

### 修正方針
以下の関数を `main.go` に切り出す（またはパッケージ内ヘルパーとして分離）:

```go
// オプション系ハンドラーの初期化を独立関数に切り出す
func initOAuthHandler(db, jwtCfg, redisClient) *handlers.OAuthHandler
func initPlacesHandlers(db, redisClient) (*handlers.SuggestionHandler, *handlers.PlacePhotoHandler)
```

`main()` は最終的に「初期化 → Setup → Run」の3行程度に収める。

---

## ２. `backend/services/gamification.go` — `ProcessGamification()` のトランザクション内部分解

### 問題
トランザクションクロージャ内に約100行が詰め込まれており、以下の複数フェーズが視覚的区切りなしに続く:
1. 初エリア判定（DBクエリ+ループ）
2. XP内訳計算（ベース・ボーナスの各分岐）
3. visit/userレコード更新
4. ジャンル熟練度更新
5. ストリーク更新
6. ストリークボーナス適用（再クエリが必要なため別ブロック）
7. バッジチェック

### 修正方針

```go
// フェーズ1: 初エリア判定
func isFirstAreaVisit(tx *gorm.DB, userID uint64, visit models.Visit) bool

// フェーズ2: XP内訳計算（副作用なし、純粋関数）
func buildXPBreakdown(isComfortZone, isFirstArea, hasMemo bool, streakBonus int) XPBreakdown

// フェーズ3+4+5: XP・レベル・熟練度・ストリーク更新をまとめる
func applyXPAndProgression(tx *gorm.DB, userID uint64, visit models.Visit, xpEarned int) (newTotalXP, newLevel int, streakBonus int, err error)
```

`ProcessGamification()` のトランザクション本体は:
```go
isFirstArea := isFirstAreaVisit(tx, userID, visit)
hasMemo := visit.Memo != nil && *visit.Memo != ""
xpEarned := CalcXP(visit.IsComfortZone, isFirstArea, hasMemo)
newTotalXP, newLevel, streakBonus, err := applyXPAndProgression(tx, userID, visit, xpEarned)
// ...result構築
newBadges, err := CheckAndAwardBadges(...)
```

という読み方ができる構造にする。

---

## ３. `backend/handlers/visit.go` — `CreateVisit()` の責務分離

### 問題
以下がひとつのハンドラー関数に並んでいる:
- リクエスト解析・バリデーション
- 日次上限チェック
- ジャンル名解決 + コンフォートゾーン判定 + GenreTagID解決（3つの関連処理）
- Visit構築・DB保存
- ゲーミフィケーション処理
- レスポンス構築

### 修正方針

```go
// ジャンル名解決・コンフォートゾーン判定・GenreTagIDの3点セットを1関数に
type genreResolution struct {
    IsComfortZone bool
    GenreTagID    *uint64
}
func resolveGenreInfo(db *gorm.DB, userID uint64, placeTypes []string) genreResolution
```

`CreateVisit()` の中の15行のif/elseブロックが:
```go
genre := resolveGenreInfo(h.DB, userID, req.PlaceTypes)
```
の1行になる。

---

## 優先度

| # | ファイル | 効果 | 実装コスト |
|---|---------|------|-----------|
| 1 | `services/gamification.go` | 高（長大なtxクロージャ） | 中 |
| 2 | `handlers/visit.go` | 中 | 低 |
| 3 | `main.go` | 中 | 中 |

`visit.go` → `gamification.go` → `main.go` の順で対応する。
