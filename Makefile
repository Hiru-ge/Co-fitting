# .PHONY は「これはファイル名ではなくコマンド名だよ」と宣言するものです
.PHONY: help up down build restart logs logs-be logs-fe db-shell test-be

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

# バックエンドのテスト実行（まだテストはありませんが、枠だけ用意）
test-be:
	docker-compose exec backend go test ./...