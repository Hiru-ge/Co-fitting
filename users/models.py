from django.db import models
from django.contrib.auth.models import BaseUserManager, AbstractBaseUser, PermissionsMixin
from django.utils import timezone
from django.contrib.auth import logout
from Co_fitting.services.email_service import EmailService
from Co_fitting.utils.security_utils import SecurityUtils


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
        user.share_limit = 1
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None):
        user = self.model(
            username=username,
            email=email,
        )
        user.set_password(password)
        user.preset_limit = 1
        user.share_limit = 1
        user.is_staff = True
        user.is_active = True
        user.is_superuser = True
        user.save(using=self._db)
        return user

    @staticmethod
    def get_client_ip(request):
        """リクエストのIPアドレスを取得"""
        return SecurityUtils.get_client_ip(request)

    @staticmethod
    def send_login_notification_async(user, ip_address):
        """ログイン通知メールを非同期で送信"""
        EmailService.send_login_notification_async(user, ip_address)

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
    def create_inactive_user_with_confirmation(form, request):
        """非アクティブユーザーを作成して確認メールを送信"""
        user = form.save(commit=False)
        user.is_active = False
        form.save()

        # トークン生成とメール送信
        confirmation_link = SecurityUtils.generate_confirmation_tokens(
            user, request, "users:signup_confirm"
        )
        EmailService.send_signup_confirmation_email(user, confirmation_link)

        return user

    @staticmethod
    def send_email_change_confirmation(user, new_email, request):
        """メールアドレス変更確認メールを送信"""
        confirmation_link = SecurityUtils.generate_confirmation_tokens(
            user, request, "users:email_change_confirm", new_email
        )
        EmailService.send_email_change_confirmation_email(user, new_email, confirmation_link)

    @staticmethod
    def get_subscription_status(user):
        """ユーザーのサブスクリプション状態を取得"""
        if user.is_subscribed:
            return "契約中"
        else:
            return "未契約"

    @staticmethod
    def change_user_password(user, new_password, request=None):
        """ユーザーのパスワードを変更し、必要に応じてログアウト処理を行う"""
        user.set_password(new_password)
        user.save()

        # リクエストが提供されている場合はログアウト処理を行う
        if request:
            logout(request)

        return user


class User(AbstractBaseUser, PermissionsMixin):
    username = models.CharField(max_length=255)
    email = models.EmailField(max_length=255, unique=True)
    is_subscribed = models.BooleanField(default=False)
    preset_limit = models.IntegerField(default=1)
    share_limit = models.IntegerField(default=1)
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
