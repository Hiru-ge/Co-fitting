from django.db import models
from django.contrib.auth.models import BaseUserManager, AbstractBaseUser, PermissionsMixin
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import default_token_generator
from django.urls import reverse
from django.utils import timezone
from django.conf import settings
import threading


class EmailService:
    """メール送信のサービスクラス"""
    
    @staticmethod
    def send_signup_confirmation_email(user, confirmation_link):
        """サインアップ確認メールを送信"""
        subject = "サインアップ確認"
        message = (
            f"{user.username} さん\n\n"
            "ユーザー登録の確認です。\n\n"
            "以下のリンクをクリックして、ユーザー登録を完了してください。\n\n"
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
    def send_email_change_confirmation_email(user, new_email, confirmation_link):
        """メールアドレス変更確認メールを送信"""
        subject = "メールアドレス変更確認"
        message = (
            f"{user.username} さん\n\n"
            "メールアドレス変更の確認です。\n\n"
            "以下のリンクをクリックして、メールアドレスの変更を完了してください。\n\n"
            f"{confirmation_link}\n\n"
            "このリンクは一度しか使用できませんのでご注意ください。"
        )
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [new_email])


class TokenService:
    """トークン生成・検証のサービスクラス"""
    
    @staticmethod
    def generate_confirmation_tokens(user, request, url_name, email=None):
        """確認用のトークンを生成"""
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        
        # メールアドレスを決定（指定されていない場合はユーザーのメールアドレス）
        target_email = email or user.email
        encoded_email = urlsafe_base64_encode(force_bytes(target_email))
        
        confirmation_link = request.build_absolute_uri(
            reverse(url_name, kwargs={"uidb64": uid, "token": token, "email": encoded_email})
        )
        return confirmation_link
    
    @staticmethod
    def verify_token(uidb64, token, email=None):
        """トークンを検証"""
        try:
            uid = urlsafe_base64_decode(uidb64).decode()
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return (None, None) if email else None
        
        if not default_token_generator.check_token(user, token):
            return (None, None) if email else None
        
        if email:
            # メールアドレス変更用の場合
            try:
                decoded_email = force_str(urlsafe_base64_decode(email))
                return user, decoded_email
            except (TypeError, ValueError, OverflowError):
                return None, None
        else:
            # サインアップ用の場合
            return user


class UserManager(BaseUserManager):

    def create_user(self, username, email, password=None):
        if not email:
            raise ValueError('Enter Email!')
        user = self.model(
            username=username,
            email=email
        )
        user.set_password(password)
        user.preset_limit = 1
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None):
        user = self.model(
            username=username,
            email=email,
        )
        user.set_password(password)
        user.preset_limit = 1
        user.is_staff = True
        user.is_active = True
        user.is_superuser = True
        user.save(using=self._db)
        return user
    
    @staticmethod
    def get_client_ip(request):
        """リクエストのIPアドレスを取得"""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0]
        else:
            ip = request.META.get("REMOTE_ADDR")
        return ip
    
    @staticmethod
    def send_login_notification_async(user, ip_address):
        """ログイン通知メールを非同期で送信"""
        threading.Thread(target=EmailService.send_login_notification_email, args=(user, ip_address)).start()
    
    @staticmethod
    def activate_user(user):
        """ユーザーアカウントを有効化"""
        user.is_active = True
        user.save()
        return user
    
    @staticmethod
    def change_user_email(user, new_email):
        """ユーザーのメールアドレスを変更"""
        user.email = new_email
        user.save()
        return user
    
    @staticmethod
    def deactivate_user(user):
        """ユーザーアカウントを論理削除"""
        user.is_active = False
        user.deactivated_at = timezone.now()
        user.save()
        return user
    
    @staticmethod
    def change_password(user, old_password, new_password1, new_password2):
        """パスワード変更処理"""
        # バリデーション
        if not old_password or not new_password1 or not new_password2:
            return {'error': 'すべてのフィールドを入力してください。'}
        
        if new_password1 != new_password2:
            return {'error': '新しいパスワードが一致しません。'}
        
        # 現在のパスワードをチェック
        if not user.check_password(old_password):
            return {'error': '現在のパスワードが正しくありません。'}
        
        # パスワードを変更
        user.set_password(new_password1)
        user.save()
        
        return {'success': True}
    
    @staticmethod
    def create_inactive_user_with_confirmation(form, request):
        """非アクティブユーザーを作成して確認メールを送信"""
        user = form.save(commit=False)
        user.is_active = False
        form.save()

        # トークン生成とメール送信
        confirmation_link = TokenService.generate_confirmation_tokens(
            user, request, "users:signup_confirm"
        )
        EmailService.send_signup_confirmation_email(user, confirmation_link)
        
        return user
    
    @staticmethod
    def send_email_change_confirmation(user, new_email, request):
        """メールアドレス変更確認メールを送信"""
        confirmation_link = TokenService.generate_confirmation_tokens(
            user, request, "users:email_change_confirm", new_email
        )
        EmailService.send_email_change_confirmation_email(user, new_email, confirmation_link)


class User(AbstractBaseUser, PermissionsMixin):
    username = models.CharField(max_length=255)
    email = models.EmailField(max_length=255, unique=True)
    is_subscribed = models.BooleanField(default=False)
    preset_limit = models.IntegerField(default=1)
    is_active = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    deactivated_at = models.DateTimeField(null=True, blank=True)  # 退会日時を記録するフィールド(退会から30日経ったらDBから完全削除する)
    stripe_customer_id = models.CharField(max_length=255, null=True, blank=True)  # サブスクリプション管理用のStripe顧客ID

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        db_table = "User"   # テーブル名

    def __str__(self):
        return self.email
