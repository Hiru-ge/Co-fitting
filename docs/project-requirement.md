# Co-fitting 要件定義書

## 1. プロジェクト概要

Co-fittingは、コーヒーの味を維持したまま、出来上がり量を変化させる変換器です。ユーザーは既存のレシピを基に、希望する量に合わせてレシピを変換することができます。

## 2. テーブル設計

### 2.1 User テーブル
```sql
CREATE TABLE User (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(128) NOT NULL,
    is_subscribed BOOLEAN DEFAULT FALSE,
    preset_limit INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT FALSE,
    is_staff BOOLEAN DEFAULT FALSE,
    deactivated_at DATETIME NULL,
    stripe_customer_id VARCHAR(255) NULL,
    last_login DATETIME NULL
);
```

### 2.2 Recipe テーブル
```sql
CREATE TABLE Recipe (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(30) NOT NULL,
    create_user_id BIGINT NOT NULL,
    is_ice BOOLEAN DEFAULT FALSE,
    ice_g FLOAT NULL,
    len_steps INTEGER NOT NULL,
    bean_g FLOAT NOT NULL,
    water_ml FLOAT NOT NULL,
    memo TEXT NULL,
    FOREIGN KEY (create_user_id) REFERENCES User(id) ON DELETE CASCADE
);
```

### 2.3 RecipeStep テーブル
```sql
CREATE TABLE RecipeStep (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    recipe_id BIGINT NOT NULL,
    step_number INTEGER NOT NULL,
    minute INTEGER NOT NULL,
    seconds INTEGER NOT NULL,
    total_water_ml_this_step FLOAT NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES Recipe(id) ON DELETE CASCADE
);
```

## 3. 機能要件

### 3.1 コア機能
1. **レシピ変換機能**
   - 既存レシピの量を維持したまま、希望する量に変換
   - アイスコーヒーモード対応
   - 倍率変換機能
   - 豆量・総湯量・比率の自動計算機能

2. **プリセットレシピ管理**
   - デフォルトプリセットレシピの提供
   - ユーザー固有のプリセットレシピの保存
   - プリセットレシピの編集・削除機能

3. **ストップウォッチ機能**
   - 抽出時の経過時間計測
   - スタート/ストップ機能

### 3.2 ユーザー管理機能
1. **アカウント管理**
   - ユーザー登録（メール認証必須）
   - ログイン/ログアウト
   - パスワードリセット
   - メールアドレス変更
   - アカウント削除（論理削除）

2. **サブスクリプション管理**
   - 月額100円でのプリセット枠増枠（3枠追加）
   - Stripeによる決済処理
   - サブスクリプション状態の管理
   - 支払い成功/失敗時のメール通知

### 3.3 管理機能
1. **管理者機能**
   - ユーザー管理
   - レシピ管理
   - サブスクリプション管理

2. **メンテナンス機能**
   - 非アクティブユーザーの自動削除（30日後）

## 4. 技術スタック

### 4.1 バックエンド
- **フレームワーク**: Django 5.2.1
- **データベース**: SQLite（開発）/ MySQL（本番）
- **認証**: Django認証システム
- **決済**: Stripe API
- **メール送信**: Djangoメールシステム

### 4.2 フロントエンド
- **HTML5/CSS3**: レスポンシブデザイン
- **JavaScript/jQuery**: 動的UI処理
- **Bootstrap**: UIフレームワーク

### 4.3 インフラストラクチャ
- **バージョン管理**: Git
- **CI/CD**: GitHub Actions

### 4.4 セキュリティ
- CSRF対策
- XSS対策
- SQLインジェクション対策
- パスワードハッシュ化
- メール認証によるアカウント有効化

## 5. 制約事項

### 5.1 技術的制約
- ブラウザ対応: 最新2バージョンのChrome, Firefox, Safari, Edge
- モバイル対応: レスポンシブデザイン

### 5.2 ビジネス制約
- 無料ユーザー: プリセット枠1つ
- 有料ユーザー: プリセット枠4つ（月額100円）

## 6. 今後の展開

### 6.1 予定機能
- 高度な変換機能の実装
- レシピ共有機能

### 6.2 改善予定
- 湯の抜けを考慮した変換アルゴリズム
- UI/UXの改善
- パフォーマンスの最適化 