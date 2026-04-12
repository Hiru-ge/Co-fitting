# Redis / localStorage 使い分け設計

## Redis（バックエンド管理）

複数端末対応・日付リセット・バックエンド側で制御すべきものはすべてRedisで管理する。

| 用途 | キー | 管理ファイル |
|---|---|---|
| 日次提案キャッシュ（選出済み3件） | `suggestion:daily:{userID}:{date}:{lat}_{lng}` | `database/redis.go` |
| 日次上限到達フラグ | `suggestion:count:{userID}:{date}` | `database/redis.go` |
| 日次リロードカウント | `suggestion:reload:{userID}:{date}` | `database/redis.go` |
| Places APIレスポンスキャッシュ | `places:v2:{placeID}` | `handlers/suggestion.go`（要移動）|
| JWTブラックリスト | `blacklist:{token}` | `utils/blacklist.go` |

## localStorage（フロントエンド管理）

**原則: UIの表示状態のみ**。データや制限管理はRedisに寄せること（複数端末対応のため）。

| 用途 | キー | 管理ファイル |
|---|---|---|
| JWTアクセストークン / リフレッシュトークン | `roamble_token` / `roamble_refresh_token` | `lib/token-storage.ts` |
| ベータ合言葉解錠フラグ | `beta_access` | `lib/beta-access.ts` |
| オンボーディングスキップ済み | `onboarding_skipped` | `routes/onboarding.tsx` |
| ホームツアー表示済み | `home_tour_seen` | `routes/profile.tsx` 他 |
| プッシュ通知バナー非表示 | `push-banner-dismissed` | `components/PushNotificationBanner.tsx` |
| PWAインストールバナー非表示 | PWA_DISMISSED_KEY | `lib/pwa.ts` |

## 対応状況

### 提案キャッシュの二重管理（Issue #314: 対応済み）

以前は提案データが2箇所でキャッシュされていた：

- **Redis**: `suggestion:daily:{userID}:{date}:{lat}_{lng}`（バックエンド）
- **localStorage**: `SUGGESTIONS_CACHE_KEY`（フロントエンド、`hooks/use-suggestions.ts`）

同様に「今日の提案を全件完了したか」も：

- **Redis**: `suggestion:count:{userID}:{date}`（日次上限到達フラグ）
- **localStorage**: `COMPLETED_KEY`（`hooks/use-suggestions.ts`）

現在は localStorage の提案キャッシュ・完了フラグを廃止し、Redis に一本化済み。

- フロントエンドは提案取得時に毎回 `/api/suggestions` を呼び、サーバー側（日次Redisキャッシュ）を正として復元する
- 複数端末で同一ユーザーの整合性を保てる
- `refresh_suggestions=true` の即時反映時も Redis 側のリロードカウント管理に統一される

### まだ対応していない項目

#### Places APIキャッシュキーが redis.go に定義されていない

`handlers/suggestion.go` 内で `"places:v2:%s"` をハードコードしている。
他のRedisキーはすべて `database/redis.go` に集約されているため、ここに移動すべき。
