# フロントエンドコード読解メモ

## 全体像・読む順番の指針

React Router v7 の SPA。`root.tsx` でベータゲート判定 → 各ルートの `clientLoader` で認証チェック → ページ描画、という流れが基本骨格。

### 推奨読書順

1. **エントリーポイント** — `root.tsx` → `routes.ts`（全体のルーティング把握）
2. **認証・トークン管理** — `lib/token-storage.ts` → `lib/auth.ts` → `lib/token-refresh.ts` → `lib/beta-access.ts`
3. **API通信基盤** — `api/client.ts`（401自動リトライの仕組みを理解してから各APIファイルへ）
4. **ユーティリティ** — `utils/constants.ts` → `utils/error.ts` → `utils/geolocation.ts`（他のファイルから頻繁に参照される）
5. **メイン画面** — `routes/home.tsx` → `hooks/use-suggestions.ts`（アプリのコアロジックが集中している）
6. **その他ルート** — `routes/login.tsx` → `routes/onboarding.tsx` → `routes/history.tsx` 等
7. **コンポーネント** — `components/discovery-card.tsx` → ゲーミフィケーション系（xp-modal, badge-modal）→ その他
8. **残りAPI・型定義** — `api/` 各ファイル → `types/` 各ファイル

---

## 読み終わったファイル

| ファイル | 状態 |
|---|---|
| （まだなし） | |

---

## まだ読んでいないファイル

### エントリーポイント・設定

- `frontend/app/root.tsx` — グローバルレイアウト＋ベータゲート判定 clientLoader
- `frontend/app/routes.ts` — 全ルート定義（React Router v7形式）
- `frontend/vite.config.ts` — OGP静的注入プラグイン・PWAマニフェスト設定
- `frontend/react-router.config.ts` — SPA モード（SSR: false）設定
- `frontend/vitest.config.ts` / `frontend/vitest.setup.ts` — テスト設定

### layouts/

- `frontend/app/layouts/app-layout.tsx` — 認証必須ページの共通レイアウト（BottomNav・pb-24）
- `frontend/app/layouts/auth-layout.tsx` — 認証前ページの共通レイアウト

### lib/

- `frontend/app/lib/token-storage.ts` — localStorage の低レベルAPI（getToken / setToken / clearToken）
- `frontend/app/lib/auth.ts` — logout / getUser / googleOAuth のラッパー
- `frontend/app/lib/token-refresh.ts` — refreshToken / tryRefreshToken（自動更新ロジック）
- `frontend/app/lib/beta-access.ts` — isBetaUnlocked / unlockBeta / lockBeta
- `frontend/app/lib/gtag.ts` — GA4 イベントトラッキング（29関数）
- `frontend/app/lib/pwa.ts` — PWA制御（isStandalone / detectPlatform / triggerInstallPrompt）
- `frontend/app/lib/push.ts` — Web Push通知（subscribePush / unsubscribePush）
- `frontend/app/lib/protected-loader.ts` — 認証必須ページ用の clientLoader ヘルパー

### api/

- `frontend/app/api/client.ts` — apiCall() 基盤・401時の自動リトライ・ApiError throw
- `frontend/app/api/users.ts` — updateDisplayName / updateSearchRadius / deleteAccount / getUserStats 等
- `frontend/app/api/genres.ts` — getGenreTags / getInterests / updateInterests
- `frontend/app/api/visits.ts` — createVisit / getVisit / updateVisit / listVisits / getMapVisits
- `frontend/app/api/places.ts` — getPlacePhoto
- `frontend/app/api/suggestions.ts` — getSuggestions（日次キャッシュ対応）
- `frontend/app/api/notifications.ts` — VAPID公開鍵取得 / 通知設定取得・更新 / Push購読登録・解除

### utils/

- `frontend/app/utils/constants.ts` — API_BASE_URL / DEFAULT_LOCATION（渋谷）/ DEFAULT_RADIUS / CHECKIN_DISTANCE_THRESHOLD（200m）
- `frontend/app/utils/error.ts` — ApiError クラス / API_ERROR_CODES / parseApiError / toUserMessage
- `frontend/app/utils/geolocation.ts` — getCurrentPosition / startPositionPolling（30秒間隔）/ isWithinCheckInRange / calcDistance
- `frontend/app/utils/category-map.ts` — GooglePlacesタイプ → icon/gradient マッピング（30+カテゴリ）
- `frontend/app/utils/badge-icon.ts` — バッジID → icon URL マッピング
- `frontend/app/utils/level.ts` — XP → レベル変換
- `frontend/app/utils/helpers.ts` — buildGoogleMapsPlaceUrl / formatDistance

### hooks/

- `frontend/app/hooks/use-suggestions.ts` — **コアロジック**（240+行）：提案取得→Photo→チェックイン→XP/Badge表示管理・位置情報ポーリング
- `frontend/app/hooks/use-modal-close.ts` — Escape キーで onClose()
- `frontend/app/hooks/use-push-banner-visible.ts` — Push通知バナー表示判定ロジック
- `frontend/app/hooks/use-form-message.ts` — フォーム状態管理（msg / error / reset）

### types/

- `frontend/app/types/auth.ts` — User / UserStats / EarnedBadge / Proficiency / AuthResponse
- `frontend/app/types/visit.ts` — Visit / CreateVisitRequest / CreateVisitResponse / XPBreakdown / BadgeInfo 等
- `frontend/app/types/suggestion.ts` — Place（is_interest_match / is_breakout 含む）
- `frontend/app/types/genre.ts` — GenreTag / Interest
- `frontend/app/types/notification.ts` — NotificationSettings
- `frontend/app/types/env.d.ts` — import.meta.env 拡張定義

### routes/

- `frontend/app/routes/index.tsx` — ランディングページ（「さっそく始める」CTA）
- `frontend/app/routes/login.tsx` — Google OAuth ログイン
- `frontend/app/routes/onboarding.tsx` — 興味タグ選択（3個以上で完了）
- `frontend/app/routes/home.tsx` — **メイン発見画面**（提案施設スタック）
- `frontend/app/routes/history.tsx` — 訪問履歴一覧
- `frontend/app/routes/history-detail.tsx` — 訪問詳細（メモ・評価編集）
- `frontend/app/routes/profile.tsx` — プロフィール（レベル・バッジ・熟練度）
- `frontend/app/routes/settings.tsx` — 設定（検索半径・興味・通知・アカウント削除）
- `frontend/app/routes/summary.weekly.tsx` — 週間サマリー
- `frontend/app/routes/summary.monthly.tsx` — 月間サマリー
- `frontend/app/routes/lp.tsx` — 製品説明LP
- `frontend/app/routes/privacy.tsx` — プライバシーポリシー
- `frontend/app/routes/beta-gate.tsx` — ベータ版合言葉入力
- `frontend/app/routes/pwa-prompt.tsx` — PWAインストール促進

### components/

- `frontend/app/components/toast.tsx` — グローバル通知（Context + 3秒自動閉じ）
- `frontend/app/components/bottom-nav.tsx` — 固定フッターナビ
- `frontend/app/components/app-header.tsx` — ヘッダー
- `frontend/app/components/discovery-card.tsx` — 提案施設カード（Swipe/Photo/距離）
- `frontend/app/components/action-buttons.tsx` — 「行った」「スキップ」「リロード」ボタン
- `frontend/app/components/card-indicator.tsx` — スタック内カード位置表示（ドット）
- `frontend/app/components/complete-card.tsx` — 本日3件完了画面
- `frontend/app/components/xp-modal.tsx` — XP獲得＆レベルアップ表示
- `frontend/app/components/badge-modal.tsx` — バッジ獲得モーダル
- `frontend/app/components/badge-toast.tsx` — バッジ獲得トースト
- `frontend/app/components/confetti-decoration.tsx` — パーティクル演出
- `frontend/app/components/SummaryLayout.tsx` — サマリー共通レイアウト
- `frontend/app/components/NotificationTab.tsx` — 通知履歴タブ
- `frontend/app/components/NotificationToggle.tsx` — Push通知トグルスイッチ
- `frontend/app/components/PushNotificationBanner.tsx` — Push通知勧誘バナー
- `frontend/app/components/location-permission-modal.tsx` — 位置情報許可要求
- `frontend/app/components/visit-map.tsx` — 訪問地点マップ（@vis.gl/react-google-maps）
- `frontend/app/components/HomeTourModal.tsx` — 初回チュートリアル

### e2e/

- `frontend/e2e/main-flow.spec.ts` — E2Eメインフロー（ランディング→ログイン→オンボーディング→ホーム→履歴→プロフィール→ログアウト）

**読まなくてよいファイル**
- `frontend/app/__tests__/` 以下 — テストは読解対象外

---

## 未解決の疑問（仕様・設計系）


---

## コード品質への指摘リスト


---

## 起票済みIssue


---

## 別チャットへの引き継ぎプロンプト

```
Roambleのフロントエンドコードを読み進めています。前のチャットからの続きです。

## これまでに読み終わったファイル

`docs/frontend-code-reading-notes.md` の「読み終わったファイル」を参照してください。

## 進め方のルール
- 私がコードを読みながらダラダラ喋るので、認識の正しさを判断したり疑問に答えたりしてください
- 音声認識の精度によってブレがあるので加味してください
- 疑問・気づきは一問一答で、一つ答えたら次を待ってください
- Issue作成など、私が明示的に依頼していないアクションは勝手に行わないでください
- コード品質への指摘や仕様疑問は `docs/frontend-code-reading-notes.md` に随時追記してください

## 現状の疑問・指摘リスト
`docs/frontend-code-reading-notes.md` を参照してください。

## 次に読む予定のファイル
`docs/frontend-code-reading-notes.md` の「まだ読んでいないファイル」を参照してください。
推奨読書順：エントリーポイント（root.tsx → routes.ts）→ 認証lib → API基盤（api/client.ts）→ utils → home.tsx → hooks/use-suggestions.ts → コンポーネント
```
