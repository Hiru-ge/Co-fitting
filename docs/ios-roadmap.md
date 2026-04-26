# Roamble iOS アプリ開発ロードマップ

**フェーズ**: Phase 3（通知機能実装後に着手）
**目標期間**: 2026年5月〜7月（3ヶ月）
**技術スタック**: React Native（Expo）、iOS中心
**方針**: Webアプリの全機能を移植（ベータ合言葉・PWA関連は削除）

---

## 事前に目を通すドキュメント（着手前に読む）

| 既読 | ドキュメント | URL | 目的 |
|---|---|---|---|
| [x] | Expo Get Started | https://docs.expo.dev/get-started/introduction/ | 環境構築・全体像の把握 |
| [x] | Expo チュートリアル | https://docs.expo.dev/tutorial/introduction/ | Expo Router・基本操作 |
| [ ] | App Store Review Guidelines | https://developer.apple.com/app-store/review/guidelines/ | 審査でリジェクトされないために必読 |
| [ ] | Apple Human Interface Guidelines | https://developer.apple.com/design/human-interface-guidelines/ | iOSらしいUI設計のルール |
| [ ] | Sign in with Apple（Expo） | https://docs.expo.dev/versions/latest/sdk/apple-authentication/ | Google認証に加えて必須実装 |

> **注意**: App Store に Google等のサードパーティログインを使う場合、Sign in with Apple の併用が規約で必須（2020年6月〜）。未対応はリジェクト対象。

---

## 5月：認証基盤 + 全機能実装

Apple Developer Program は5月初旬に申請しておく（審査に数日かかるため早めに済ませる）。

### 4月末先行（〜4/30）
- [ ] Google OAuth 実装開始（`expo-auth-session` + `expo-secure-store`）

### 1週目（GW・5/1〜5/6）
- [ ] Apple Developer Program 申請
- [ ] Google OAuth 完成・動作確認
- [ ] 全画面プレースホルダー実装（タブ構成: 提案 / 訪問履歴 / マップ / プロフィール）
- [ ] GET系APIの繋ぎ込み
  - `GET /api/users/me` — プロフィール画面
  - `GET /api/users/me/stats` — XP・レベル統計
  - `GET /api/users/me/badges` — バッジ一覧
  - `GET /api/users/me/proficiency` — ジャンル習熟度
  - `GET /api/users/me/interests` — 興味タグ
  - `GET /api/genres` — ジャンル一覧
  - `GET /api/visits` — 訪問履歴一覧
  - `GET /api/visits/map` — 訪問マップ（ピン表示）
  - `GET /api/places/:placeId/photo` — 施設写真

### 2週目
- [ ] POST/PUT/PATCH/DELETE 繋ぎ込み
  - `POST /api/suggestions` — 提案生成（`expo-location` で位置情報取得）
  - `POST /api/visits` — 訪問記録入力
  - `PATCH /api/visits/:id` — 訪問記録更新
  - `GET /api/visits/:id` — 訪問記録詳細
  - `PUT /api/users/me/interests` — 興味タグ更新
  - `PATCH /api/users/me` — プロフィール編集
  - `DELETE /api/users/me` — アカウント削除
  - `POST /api/auth/refresh` — トークンリフレッシュ
  - `POST /api/auth/logout` — ログアウト

### 3週目
- [ ] **Sign in with Apple 実装**
  - フロントエンド: `expo-apple-authentication` 使用
  - バックエンド: `/api/auth/oauth/apple` エンドポイント新規追加
  - Apple Developer Program 登録後にシミュレーターでもテスト可能

### 4週目（バッファ）
- [ ] 積み残し対応
- [ ] 実機ドッグフーディング（EAS Build → 自分のiPhoneに配信）
- [ ] ESLint・Prettier・TypeScript 設定

---

## 6月：磨き込み + App Store申請素材準備

インターン前学習（Rails/GCP）と並行して進める。各週のインターン前学習ノルマ達成後に初めてiOS作業に着手すること。

### iOSネイティブ対応・polish
- [ ] 触覚フィードバック（`expo-haptics`）の導入
  - 訪問記録完了時・バッジ獲得時などフィードバック箇所を設計してから入れる
- [ ] Safe Area 対応（ノッチ・Dynamic Island）
- [ ] 権限ダイアログの文言整備（位置情報: `NSLocationWhenInUseUsageDescription`）
- [ ] アニメーション・UI polish（バッジ獲得演出など）

### 課金設計
- [ ] 課金体系の設計（サブスク vs 買い切り vs 広告モデル、広告を出すタイミング）
- [ ] RevenueCat 導入・サブスク基盤構築
- [ ] App Store Connect で In-App Purchase 商品登録（審査あり、早めに着手）

### App Store申請素材準備
- [ ] アプリアイコン（1024×1024px）
- [ ] スプラッシュスクリーン
- [ ] スクリーンショット（6.9インチ・6.5インチ用）
- [ ] アプリ説明文（日本語）・ASO設計（キーワード100文字）
- [ ] プライバシーポリシー画面（アプリ内に組み込み必須）
- [ ] 審査用テストアカウントの用意

### ベータ合言葉・PWA関連の削除
- [ ] ベータ合言葉ロジックの削除（iOS版では不要）

---

## 7月：審査・公開

### App Store 審査申請
- [ ] App Store Connect に申請情報入力
- [ ] 審査申請（初回は1〜7日程度）
- [ ] リジェクト対応（あれば修正→再申請）
- [ ] リリース

### リリース後
- [ ] Product Hunt 登録
- [ ] レビュー依頼 in-app prompt の動作確認
- [ ] X・TikTok で「リリースしました」投稿
- [ ] 初動データ確認（App Store 検索ワード流入・RevenueCat 転換率）

---

## よくあるリジェクト対策チェックリスト

審査申請前に以下を必ず確認すること。

- [ ] Sign in with Apple が実装されている（Guideline 4.8）
- [ ] プライバシーポリシーがアプリ内からアクセスできる（5.1.1）
- [ ] 位置情報の利用目的が説明文に明記されている（5.1.1）
- [ ] 審査用テストアカウントを App Store Connect の「メモ」欄に記載
- [ ] クラッシュなし（審査官環境での動作確認）
- [ ] App Store のスクリーンショットが実際の画面と一致している
- [ ] 課金機能がある場合は In-App Purchase 使用（Stripe直払い禁止 / 3.1.1）

---

## 技術選定メモ

| 用途 | ライブラリ |
|---|---|
| ルーティング | Expo Router |
| 認証（Google） | expo-auth-session |
| 認証（Apple） | expo-apple-authentication |
| セキュアストレージ | expo-secure-store |
| 位置情報 | expo-location |
| 地図 | react-native-maps |
| 触覚フィードバック | expo-haptics |
| 課金管理 | RevenueCat |
| ビルド・配信 | EAS Build / EAS Submit |
