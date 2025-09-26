"""
プロジェクト全体で使用する定数クラス
"""
from django.conf import settings


class AppConstants:
    """アプリケーション全体の定数"""
    
    # プリセット制限
    FREE_PRESET_LIMIT = 1
    PREMIUM_PRESET_LIMIT = 4
    
    # 共有制限
    SHARE_LIMIT_FREE = 1  # 無料ユーザーの共有リンク数制限
    SHARE_LIMIT_PREMIUM = 5  # サブスクユーザーの共有リンク数制限
    
    # トークン設定
    TOKEN_LENGTH = 16
    
    # サブスクリプション状態
    ACTIVE_STATUSES = ['active', 'trialing']
    INACTIVE_STATUSES = ['canceled', 'unpaid', 'incomplete_expired', 'past_due']
    
    # Stripe設定
    STRIPE_API_KEY = settings.STRIPE_API_KEY
    STRIPE_PRICE_ID = settings.STRIPE_PRICE_ID


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


