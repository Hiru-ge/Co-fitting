from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import default_token_generator
from django.urls import reverse


class SecurityUtils:
    """セキュリティ関連のユーティリティクラス"""

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
    def generate_confirmation_tokens(user, request, url_name, email=None):
        """確認用のトークンを生成"""
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        # メールアドレスを決定（指定されていない場合はユーザーのメールアドレス）
        target_email = email or user.email
        encoded_email = urlsafe_base64_encode(force_bytes(target_email))

        # 確認URLを生成
        confirmation_url = reverse(url_name, kwargs={
            'uidb64': uid,
            'token': token,
            'email': encoded_email
        })

        return request.build_absolute_uri(confirmation_url)

    @staticmethod
    def verify_confirmation_tokens(uidb64, token, email=None):
        """確認用のトークンを検証"""
        from django.contrib.auth import get_user_model
        User = get_user_model()

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
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
