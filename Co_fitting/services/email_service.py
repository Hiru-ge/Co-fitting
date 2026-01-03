import threading
from django.core.mail import send_mail
from django.conf import settings
from django.urls import reverse
from django.utils import timezone
from Co_fitting.utils.constants import AppConstants


class EmailService:
    """メール送信のサービスクラス"""

    @staticmethod
    def _get_plan_display_name(plan_type):
        """プランタイプから表示名を取得"""
        plan_names = {
            AppConstants.PLAN_FREE: 'フリー',
            AppConstants.PLAN_BASIC: 'ベーシック',
            AppConstants.PLAN_PREMIUM: 'プレミアム',
            AppConstants.PLAN_UNLIMITED: 'アンリミテッド',
        }
        return plan_names.get(plan_type, plan_type)

    @staticmethod
    def _get_plan_features(plan_type):
        """プランの特典内容を取得"""
        preset_limit = AppConstants.PRESET_LIMITS.get(plan_type, 1)
        share_limit = AppConstants.SHARE_LIMITS.get(plan_type, 1)
        has_pip = plan_type in AppConstants.PIP_ENABLED_PLANS

        features = [
            f"- プリセットレシピ保存数: {preset_limit}個",
            f"- レシピ共有数: {share_limit}個",
        ]

        if has_pip:
            features.append("- PiP（ピクチャーインピクチャー）機能: 利用可能")

        return "\n".join(features)

    @staticmethod
    def send_signup_confirmation_email(user, confirmation_link):
        """サインアップ確認メールを送信"""
        subject = "アカウント登録の確認"
        message = (
            f"{user.username} さん\n\n"
            "Co-fittingのアカウント登録ありがとうございます。\n\n"
            "以下のリンクをクリックしてアカウントを有効化してください：\n\n"
            f"{confirmation_link}\n\n"
            "このリンクは一度しか使用できませんのでご注意ください。"
        )
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])

    @staticmethod
    def send_login_notification_email(user, ip_address):
        """ログイン通知メールを送信"""
        subject = "ログイン通知"
        message = (
            f"{user.username} さん\n\n"
            "Co-fittingにて、あなたのアカウントでログインがありました。\n"
            f"日時: {timezone.localtime()}\n"
            f"IPアドレス: {ip_address}\n\n"
            "もしこのログインに心当たりがない場合は、至急パスワードを変更してください。"
        )
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])

    @staticmethod
    def send_login_notification_async(user, ip_address):
        """ログイン通知メールを非同期で送信"""
        threading.Thread(target=EmailService.send_login_notification_email, args=(user, ip_address)).start()

    @staticmethod
    def send_email_change_confirmation_email(user, new_email, confirmation_link):
        """メールアドレス変更確認メールを送信"""
        subject = "メールアドレス変更の確認"
        message = (
            f"{user.username} さん\n\n"
            "メールアドレスの変更申請を受け付けました。\n\n"
            f"新しいメールアドレス: {new_email}\n\n"
            "以下のリンクをクリックして変更を確定してください：\n\n"
            f"{confirmation_link}\n\n"
            "このリンクは一度しか使用できませんのでご注意ください。"
        )
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [new_email])

    @staticmethod
    def send_subscription_created_email(user, plan_type):
        """初回サブスクリプション登録成功メールを送信"""
        plan_name = EmailService._get_plan_display_name(plan_type)
        features = EmailService._get_plan_features(plan_type)

        subject = f"【Co-fitting】{plan_name}プランへのご登録ありがとうございます"
        message = (
            f"{user.username} さん\n\n"
            f"Co-fittingの{plan_name}プランにご登録いただき、誠にありがとうございます。\n\n"
            f"ご利用いただけるプランの内容は以下の通りです：\n\n"
            f"{features}\n\n"
            "これらの機能は今すぐご利用いただけます。\n"
            "マイページから早速お試しください。\n\n"
            "次回の課金日は、ご登録から1ヶ月後となります。\n\n"
            "サブスクリプションの管理（プラン変更・解約など）は、\n"
            "マイページの「サブスクリプション管理」から行えます。\n\n"
            "これからもCo-fittingをよろしくお願いいたします。"
        )
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])

    @staticmethod
    def send_subscription_renewed_email(user, plan_type):
        """継続課金成功メールを送信"""
        plan_name = EmailService._get_plan_display_name(plan_type)

        subject = f"【Co-fitting】{plan_name}プランの継続課金が完了しました"
        message = (
            f"{user.username} さん\n\n"
            "いつもCo-fittingをご利用いただき、ありがとうございます。\n\n"
            f"{plan_name}プランの月額料金の決済が正常に完了いたしました。\n\n"
            "引き続き、すべての機能をご利用いただけます。\n"
            "次回の課金日は、本日から1ヶ月後となります。\n\n"
            "これからもCo-fittingをよろしくお願いいたします。"
        )
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])

    @staticmethod
    def send_plan_upgraded_email(user, old_plan_type, new_plan_type):
        """プランアップグレード成功メールを送信"""
        old_plan_name = EmailService._get_plan_display_name(old_plan_type)
        new_plan_name = EmailService._get_plan_display_name(new_plan_type)
        features = EmailService._get_plan_features(new_plan_type)

        subject = f"【Co-fitting】{new_plan_name}プランへのアップグレードが完了しました"
        message = (
            f"{user.username} さん\n\n"
            f"{old_plan_name}プランから{new_plan_name}プランへのアップグレードが完了しました。\n\n"
            f"ご利用いただける新しいプランの内容は以下の通りです：\n\n"
            f"{features}\n\n"
            "これらの機能は今すぐご利用いただけます。\n\n"
            "プラン変更に伴う差額は、本日付で決済させていただきました。\n"
            "次回の定期課金は、新しいプラン料金で請求されます。\n\n"
            "これからもCo-fittingをよろしくお願いいたします。"
        )
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])

    @staticmethod
    def send_plan_downgraded_email(user, old_plan_type, new_plan_type, deleted_presets_count=0, deleted_shares_count=0):
        """プランダウングレード成功メールを送信"""
        old_plan_name = EmailService._get_plan_display_name(old_plan_type)
        new_plan_name = EmailService._get_plan_display_name(new_plan_type)
        features = EmailService._get_plan_features(new_plan_type)

        subject = f"【Co-fitting】{new_plan_name}プランへの変更が完了しました"

        deletion_notice = ""
        if deleted_presets_count > 0 or deleted_shares_count > 0:
            deletion_notice = "\n【重要】プラン変更に伴うデータ削除について\n\n"
            if deleted_presets_count > 0:
                deletion_notice += f"- プリセットレシピ: 新しく作成された{deleted_presets_count}個のレシピが削除されました\n"
            if deleted_shares_count > 0:
                deletion_notice += f"- 共有レシピ: 新しく作成された{deleted_shares_count}個の共有レシピが削除されました\n"
            deletion_notice += "\n古いレシピは保持されています。\n"

        message = (
            f"{user.username} さん\n\n"
            f"{old_plan_name}プランから{new_plan_name}プランへの変更が完了しました。\n"
            f"{deletion_notice}\n"
            f"ご利用いただける新しいプランの内容は以下の通りです：\n\n"
            f"{features}\n\n"
            "次回の定期課金は、新しいプラン料金で請求されます。\n\n"
            "プラン変更はいつでも可能です。\n"
            "マイページの「サブスクリプション管理」からアップグレードいただけます。\n\n"
            "これからもCo-fittingをよろしくお願いいたします。"
        )
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])

    @staticmethod
    def send_payment_failed_email(user, request):
        """支払い失敗メールを送信"""
        subject = "【Co-fitting】お支払いに失敗しました"
        message = (
            f"{user.username} さん\n\n"
            "Co-fittingのサブスクリプション料金の決済処理に失敗しました。\n\n"
            "【考えられる原因】\n"
            "- クレジットカードの有効期限切れ\n"
            "- 利用限度額の超過\n"
            "- カード情報の不一致\n\n"
            "【対処方法】\n"
            "1. マイページの「サブスクリプション管理」にアクセス\n"
            "2. お支払い方法を更新してください\n\n"
            f"マイページURL: {request.build_absolute_uri(reverse('mypage'))}\n\n"
            "数日以内にお支払い方法を更新いただけない場合、\n"
            "サブスクリプションが自動的にキャンセルされる可能性があります。\n\n"
            "ご不明な点がございましたら、お気軽にお問い合わせください。"
        )
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])

    @staticmethod
    def send_subscription_canceled_email(user, period_end_date=None):
        """サブスクリプションキャンセル完了メールを送信"""
        subject = "【Co-fitting】サブスクリプションの解約が完了しました"

        period_notice = ""
        if period_end_date:
            period_notice = f"\n有料プランの機能は {period_end_date.strftime('%Y年%m月%d日')} までご利用いただけます。\n"

        message = (
            f"{user.username} さん\n\n"
            "サブスクリプションの解約手続きが完了しました。\n"
            f"{period_notice}\n"
            "期間終了後は、フリープランに自動的に移行します。\n\n"
            "【フリープランでご利用いただける内容】\n"
            "- プリセットレシピ保存数: 1個\n"
            "- レシピ共有数: 1個\n\n"
            "いつでも再度サブスクリプションにご登録いただけます。\n"
            "マイページから各種プランをご確認ください。\n\n"
            "これまでCo-fittingをご利用いただき、誠にありがとうございました。\n"
            "またのご利用を心よりお待ちしております。"
        )
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])

    @staticmethod
    def send_payment_success_email(user):
        """支払い成功メールを送信（後方互換性のため残す）"""
        # 新しいメソッドを使用するように変更
        # plan_typeが不明な場合はBASICとして扱う
        EmailService.send_subscription_created_email(user, user.plan_type or AppConstants.PLAN_BASIC)
