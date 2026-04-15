# Roamble iOS アプリ開発ロードマップ

**フェーズ**: Phase 3（通知機能実装後に着手）
**目標期間**: 2026年5月〜7月（3ヶ月）
**技術スタック**: React Native（Expo）、iOS中心
**方針**: Webアプリの全機能を移植（ベータ合言葉・PWA関連は削除）

---

## 事前に目を通すドキュメント（着手前に読む）

| ドキュメント | URL | 目的 |
|---|---|---|
| Expo Get Started | https://docs.expo.dev/get-started/introduction/ | 環境構築・全体像の把握 |
| Expo Router | https://expo.github.io/router/docs/ | ルーティング（React Routerに近い） |
| App Store Review Guidelines | https://developer.apple.com/app-store/review/guidelines/ | 審査でリジェクトされないために必読 |
| Apple Human Interface Guidelines | https://developer.apple.com/design/human-interface-guidelines/ | iOSらしいUI設計のルール |
| Sign in with Apple（Expo） | https://docs.expo.dev/versions/latest/sdk/apple-authentication/ | Google認証に加えて必須実装 |

> **注意**: App Store に Google等のサードパーティログインを使う場合、Sign in with Apple の併用が規約で必須（2020年6月〜）。未対応はリジェクト対象。

---

## Phase A: 環境構築・認証基盤（5月）

### A-1. 開発環境セットアップ
- [ ] Xcode インストール（Mac App Store から）
- [ ] Expo CLI インストール（`npm install -g expo-cli`）
- [ ] `npx create-expo-app roamble-ios --template` でプロジェクト作成
- [ ] iOS シミュレーターで Hello World を動作確認
- [ ] ESLint・Prettier・TypeScript 設定

### A-2. プロジェクト基盤
- [ ] Expo Router の導入・Navigation構造の設計
  - タブ構成案: 提案 / 訪問履歴 / マップ / プロフィール
- [ ] 既存 `app/api/client.ts` を移植（ベースURLのみ変更）
- [ ] 認証トークン管理（`expo-secure-store` を使いSecure Storageに保存）
- [ ] 認証保護ルートのパターン実装

### A-3. 認証機能
- [ ] Google OAuth 実装（`expo-auth-session` 使用）
- [ ] **Sign in with Apple 実装**（`expo-apple-authentication` 使用）
  - バックエンド: `/api/auth/oauth/apple` エンドポイント追加
  - Apple Developer Program 登録前でもシミュレーター上でテスト可能
- [ ] ログアウト・トークンリフレッシュ
- [ ] ベータ合言葉ロジックの**削除**（iOS版では不要）

---

## Phase B: コア機能移植（6月前半）

### B-1. 提案機能
- [ ] 提案生成画面（ジャンル選択・興味タグ連携）
- [ ] GPS権限リクエスト（`expo-location` 使用）
  - `NSLocationWhenInUseUsageDescription` に日本語で用途を明記
- [ ] Google Maps 表示（`react-native-maps` 使用）
- [ ] チャレンジモード UI

### B-2. 訪問記録機能
- [ ] 訪問記録入力画面
- [ ] 感想メモ入力
- [ ] 訪問記録一覧・詳細画面
- [ ] 訪問マップ画面（ピン表示）

### B-3. ゲーミフィケーション
- [ ] XP・レベル・統計表示画面
- [ ] バッジ一覧・取得演出（アニメーション）
- [ ] ジャンル習熟度表示

### B-4. プロフィール・設定
- [ ] プロフィール表示・編集
- [ ] 興味タグ設定
- [ ] アカウント削除

---

## Phase C: iOS固有対応・仕上げ（6月後半）

### C-1. iOSネイティブ対応
- [ ] 権限ダイアログの文言整備
  - 位置情報: `NSLocationWhenInUseUsageDescription`
- [ ] ディープリンク設定（将来的な共有機能向け）
- [ ] Safe Area 対応（ノッチ・Dynamic Island）

### C-2. PWA関連の削除
- [ ] `vite-plugin-pwa` 関連コードの削除（Web版のみ対象のため影響なし）
- [ ] ベータ合言葉（`beta-access.ts`・`/beta-gate` ルート）はWeb側のみ維持

### C-3. App Store 申請素材の準備
- [ ] アプリアイコン（1024×1024px）
- [ ] スプラッシュスクリーン
- [ ] スクリーンショット（6.9インチ・6.5インチ用）
- [ ] アプリ説明文（日本語）
- [ ] プライバシーポリシー画面（アプリ内に組み込み必須）
- [ ] 審査用テストアカウントの用意

---

## Phase D: 配信・審査（7月）

### D-1. Apple Developer Program 登録
- [ ] Apple Developer Program に登録（$99/年）
  - ※審査に数日かかるため、Phase C 完了前に登録しておく
- [ ] App Store Connect でアプリ登録

### D-2. TestFlight ベータ配信
- [ ] EAS Build で .ipa ビルド（`eas build --platform ios`）
- [ ] TestFlight に自分のiPhoneで配信
- [ ] 実機での動作確認・バグ修正

### D-3. App Store 審査申請
- [ ] App Store Connect に申請情報入力
- [ ] 審査申請（初回は1〜7日程度）
- [ ] リジェクト対応（あれば修正→再申請）
- [ ] リリース

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
| ビルド・配信 | EAS Build / EAS Submit |
