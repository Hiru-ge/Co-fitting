import threading
from django.core.mail import send_mail
from django.conf import settings
from django.urls import reverse
from django.utils import timezone


class EmailService:
    """メール送信のサービスクラス"""

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
    def send_payment_success_email(user):
        """支払い成功メールを送信"""
        subject = "支払い完了通知"
        message = (
            f"{user.username} さん\n\n"
            "Co-fittingのご利用ありがとうございます。\n\n"
            "申請いただいたサブスクリプションの支払いが完了しました。\n\n"
            "これからもCo-fittingをよろしくお願いいたします。\n\n"
        )
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])

    @staticmethod
    def send_payment_failed_email(user, request):
        """支払い失敗メールを送信"""
        subject = "支払い失敗通知"
        message = (
            f"{user.username} さん\n\n"
            "Co-fittingのご利用ありがとうございます。\n\n"
            "申請いただいたサブスクリプションの支払いが失敗しました。\n\n"
            "カード情報等をご確認の上、再度お試しください。\n\n"
            "以下のリンクからマイページにアクセスし、登録されているカード情報の更新をお申し込みいただけます。\n\n"
            f"{request.build_absolute_uri(reverse('recipes:mypage'))}\n\n"
        )
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
