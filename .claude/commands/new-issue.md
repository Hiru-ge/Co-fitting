# GitHub Issue 作成

$ARGUMENTS の内容をもとに、Roamble の命名規則に従った GitHub Issue を作成する。

## 命名規則

Issue タイトルは**実装対象を明確にした体言止め**で命名する。

- 良い例: `〇〇エンドポイント実装`、`〇〇画面実装`、`〇〇サービス実装`、`〇〇DBモデル実装`
- 悪い例: `Step 1: 〇〇を実装する`、`〇〇の実装`（冗長な「の実装」は避ける）

参考 Issue: #88「Google OAuth認証エンドポイント実装」、#107「訪問詳細画面実装」

## ラベル選択ルール

以下から**すべて**の該当ラベルを付与する:

- フェーズ: `Phase0` / `Phase1` / `Phase2` / `Phase3` / `Phase4`（現在は `Phase1`）
- 領域: `frontend` / `backend`（両方に関わる場合は両方付与）

## 作成手順

1. $ARGUMENTS から実装内容を解析してタイトルを決定する
2. タイトルと簡単な概要（1〜2文）を確認してユーザーに提示する
3. 承認を得てから以下のコマンドで Issue を作成する:

```bash
gh issue create --title "タイトル" --body "概要" --label "Phase1,backend"
```

4. 作成した Issue の URL を報告する
5. `docs/todo.md` に対応するタスクエントリ（TDD形式）を追記するかどうか確認する

## 注意事項

- Issue 本文にはタイトルと概要のみ記載する（詳細は docs/todo.md に記載する）
- git commit / push / PR 作成は絶対に行わない
