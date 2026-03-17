# TDD サイクル実行

$ARGUMENTS の機能を t-wada の TDD（RED → GREEN → REFACTOR）に従って実装する。

## 前提確認

実装を開始する前に以下を確認する:

1. 対象の Issue 番号とタスクを特定する
2. `docs/todo.md` に該当タスクが TDD 形式で記載されているか確認する（なければ追記する）
3. 現在いるブランチを確認する（`git branch`）。`feat/xxx` ブランチにいなければ作業を止めてユーザーに確認する

## 🔴 RED フェーズ

1. テストファイルを先に作成または編集する（`xxx_test.go` または `xxx.test.tsx`）
2. 期待する HTTP ステータス・戻り値・振る舞いを明確にしてテストを書く
3. テストが**失敗することを確認**してから次に進む:
   - バックエンド: `cd backend && go test ./... -run TestFuncName -v`
   - フロントエンド: `cd frontend && npx vitest run --reporter=verbose`
4. `docs/todo.md` の RED タスクにチェックを入れる

## 🟢 GREEN フェーズ

1. テストを通過させる**最小限の実装**を書く（過剰な実装はしない）
2. 必要に応じて `routes/routes.go` にルートを追加する
3. テストがすべて**PASS することを確認**する
4. `docs/todo.md` の GREEN タスクにチェックを入れる

## 🔵 REFACTOR フェーズ

1. テストが GREEN のまま以下を改善する:
   - 重複コードの切り出し
   - 型定義・インターフェースの整理
   - 命名の改善
2. リファクタリング後もテストが PASS していることを確認する
3. `docs/todo.md` の REFACTOR タスクにチェックを入れる

## 完了後

- バックエンド・フロントエンド両方の全テストを実行して回帰がないことを確認する
- `docs/todo.md` の該当タスクに最終チェックを入れる
- git commit / push / PR 作成は行わない（ユーザーが行う）
