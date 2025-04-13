from django.db import models
from django.contrib.auth.models import BaseUserManager, AbstractBaseUser, PermissionsMixin


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


class User(AbstractBaseUser, PermissionsMixin):
    username = models.CharField(max_length=255)
    email = models.EmailField(max_length=255, unique=True)
    is_subscribed = models.BooleanField(default=False, null=True)
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
