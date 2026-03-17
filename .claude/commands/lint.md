# リント実行

以下の順番でリンターを実行し、警告・エラーを報告する。

## 1. バックエンド（Go）

```bash
cd backend && go vet ./...
```

```bash
cd backend && golangci-lint run
```

## 2. フロントエンド（ESLint + Prettier）

```bash
cd frontend && npx eslint . --ext .ts,.tsx
```

```bash
cd frontend && npx prettier --check "app/**/*.{ts,tsx,css}"
```

## 対応方針

- `go vet` のエラーはすべて修正する
- `golangci-lint` の警告は重要度に応じて修正または `//nolint` コメントで抑制する（理由を必ずコメントに記載）
- ESLint エラーは修正し、警告は内容を確認して対応を判断する
- Prettier 差分は `npx prettier --write "app/**/*.{ts,tsx,css}"` で自動修正する
