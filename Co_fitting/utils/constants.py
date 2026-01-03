from django.conf import settings


class AppConstants:
    """アプリケーション全体の定数"""

    # プランタイプ定義
    PLAN_FREE = 'FREE'
    PLAN_BASIC = 'BASIC'
    PLAN_PREMIUM = 'PREMIUM'
    PLAN_UNLIMITED = 'UNLIMITED'

    PLAN_CHOICES = [
        (PLAN_FREE, 'Free'),
        (PLAN_BASIC, 'Basic'),
        (PLAN_PREMIUM, 'Premium'),
        (PLAN_UNLIMITED, 'Unlimited'),
    ]

    # プリセット制限（プランごと）
    PRESET_LIMITS = {
        PLAN_FREE: 1,
        PLAN_BASIC: 5,
        PLAN_PREMIUM: 10,
        PLAN_UNLIMITED: 100,
    }

    # 共有制限（プランごと）
    SHARE_LIMITS = {
        PLAN_FREE: 1,
        PLAN_BASIC: 5,
        PLAN_PREMIUM: 10,
        PLAN_UNLIMITED: 100,
    }

    # PiP機能アクセス権限
    PIP_ENABLED_PLANS = [PLAN_PREMIUM, PLAN_UNLIMITED]

    # レガシー定数（後方互換性のため残す。段階的に削除予定）
    FREE_PRESET_LIMIT = 1
    PREMIUM_PRESET_LIMIT = 5
    SHARE_LIMIT_FREE = 1
    SHARE_LIMIT_PREMIUM = 5

    # トークン設定
    TOKEN_LENGTH = 16

    # サブスクリプション状態
    ACTIVE_STATUSES = ['active', 'trialing']
    INACTIVE_STATUSES = ['canceled', 'unpaid', 'incomplete_expired', 'past_due']

    # Stripe設定
    STRIPE_API_KEY = settings.STRIPE_API_KEY

    # Stripe Price ID（プランごと）
    STRIPE_PRICE_IDS = {
        PLAN_BASIC: settings.STRIPE_PRICE_ID_BASIC,
        PLAN_PREMIUM: settings.STRIPE_PRICE_ID_PREMIUM,
        PLAN_UNLIMITED: settings.STRIPE_PRICE_ID_UNLIMITED,
    }


class ImageConstants:
    """画像生成関連の定数"""

    # 画像生成設定
    IMAGE_WIDTH = 1000
    BASE_HEIGHT = 500
    ROW_HEIGHT = 42
    CARD_MARGIN = 50
    CARD_RADIUS = 40
    FONT_SIZE_LARGE = 48
    FONT_SIZE_MEDIUM = 38
    FONT_SIZE_SMALL = 28
