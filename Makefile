# .PHONY は「これはファイル名ではなくコマンド名だよ」と宣言するものです
.PHONY: help up down build restart logs logs-be logs-fe db-shell test-be test-fe test-e2e test

# デフォルトで実行されるコマンド（make とだけ打った場合）
help:
	@echo "使用可能なコマンド:"
	@echo "  make up        - コンテナを起動（バックグラウンド）"
	@echo "  make down      - コンテナを停止・削除"
	@echo "  make build     - コンテナを再ビルドして起動"
	@echo "  make restart   - コンテナを再起動"
	@echo "  make logs      - 全コンテナのログを表示（Ctrl+Cで終了）"
	@echo "  make logs-be   - バックエンドのログのみ表示"
	@echo "  make db-shell  - MySQLコンテナの中に入ってSQLを実行できる状態にする"
	@echo "  make test-be   - バックエンドのユニット・統合テストを実行"
	@echo "  make test-fe   - フロントエンドのユニット・統合テストを実行（Vitest）"
	@echo "  make test-e2e  - E2Eテストを実行（Playwright）"
	@echo "  make test      - 全テストを一括実行（BE → FE → E2E）"

up:
	docker-compose up -d

down:
	docker-compose down

# 設定変更やコード追加時に便利：再ビルドして起動
build:
	docker-compose up -d --build

restart:
	docker-compose restart

logs:
	docker-compose logs -f

logs-be:
	docker-compose logs -f backend

logs-fe:
	docker-compose logs -f frontend

# DBの中に入ってデータを確認したい時に便利
# パスワード入力待ちになるので、 .env に設定したパスワードを入力してください
db-shell:
	docker exec -it roamble_db mysql -u roamble -p roamble

# バックエンドのユニット・統合テスト
test-be:
	cd backend && go test -p 1 ./...

# フロントエンドのユニット・統合テスト（Vitest）
test-fe:
	cd frontend && npx vitest run

# E2Eテスト（Playwright）
# 事前に docker-compose up でバックエンドが起動している必要があります
test-e2e:
	cd frontend && npx playwright test

# 全テスト一括実行（BE → FE → E2E）
test: test-be test-fe test-e2e
	@echo "✅ 全テスト完了"