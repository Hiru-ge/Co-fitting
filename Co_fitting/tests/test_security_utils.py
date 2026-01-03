from django.test import TestCase, RequestFactory
from django.contrib.auth import get_user_model
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import default_token_generator
from Co_fitting.utils.security_utils import SecurityUtils
from Co_fitting.tests.helpers import create_test_user, BaseTestCase

User = get_user_model()


class SecurityUtilsTestCase(BaseTestCase):
    """SecurityUtilsクラスのテスト"""

    def setUp(self):
        """テスト用ユーザーとリクエストファクトリの準備"""
        super().setUp()
        self.factory = RequestFactory()
        self.user = create_test_user()

    def test_get_client_ip_with_x_forwarded_for(self):
        """X-Forwarded-Forヘッダーがある場合のIPアドレス取得テスト"""
        request = self.factory.get('/')
        request.META['HTTP_X_FORWARDED_FOR'] = '192.168.1.1, 10.0.0.1'
        request.META['REMOTE_ADDR'] = '127.0.0.1'

        ip = SecurityUtils.get_client_ip(request)

        # X-Forwarded-Forの最初のIPアドレスが返されることを確認
        self.assertEqual(ip, '192.168.1.1')

    def test_get_client_ip_without_x_forwarded_for(self):
        """X-Forwarded-Forヘッダーがない場合のIPアドレス取得テスト"""
        request = self.factory.get('/')
        request.META['REMOTE_ADDR'] = '127.0.0.1'

        ip = SecurityUtils.get_client_ip(request)

        # REMOTE_ADDRが返されることを確認
        self.assertEqual(ip, '127.0.0.1')

    def test_get_client_ip_with_multiple_proxies(self):
        """複数のプロキシを経由した場合のIPアドレス取得テスト"""
        request = self.factory.get('/')
        request.META['HTTP_X_FORWARDED_FOR'] = '203.0.113.1, 198.51.100.1, 192.0.2.1'
        request.META['REMOTE_ADDR'] = '127.0.0.1'

        ip = SecurityUtils.get_client_ip(request)

        # 最初（最もクライアントに近い）のIPアドレスが返されることを確認
        self.assertEqual(ip, '203.0.113.1')

    def test_get_client_ip_with_empty_x_forwarded_for(self):
        """空のX-Forwarded-Forヘッダーの場合のIPアドレス取得テスト"""
        request = self.factory.get('/')
        request.META['HTTP_X_FORWARDED_FOR'] = ''
        request.META['REMOTE_ADDR'] = '127.0.0.1'

        ip = SecurityUtils.get_client_ip(request)

        # REMOTE_ADDRが返されることを確認
        self.assertEqual(ip, '127.0.0.1')

    def test_generate_confirmation_tokens_creates_valid_token(self):
        """確認トークンが正常に生成されることをテスト"""
        request = self.factory.get('/')
        request.META['HTTP_HOST'] = 'testserver'

        confirmation_url = SecurityUtils.generate_confirmation_tokens(
            self.user,
            request,
            'users:signup_confirm'
        )

        # URLが正しい形式で生成されることを確認
        self.assertIn('http://testserver/users/signup/confirm/', confirmation_url)
        # Django 3.x以降、urlsafe_base64_encodeは文字列を返すので.decode()は不要
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        self.assertIn(uid, confirmation_url)

    def test_generate_confirmation_tokens_with_custom_email(self):
        """カスタムメールアドレスでの確認トークン生成テスト"""
        request = self.factory.get('/')
        request.META['HTTP_HOST'] = 'testserver'
        custom_email = 'custom@example.com'

        confirmation_url = SecurityUtils.generate_confirmation_tokens(
            self.user,
            request,
            'users:email_change_confirm',
            email=custom_email
        )

        # URLにカスタムメールアドレスが含まれることを確認（アンダースコア区切り）
        self.assertIn('http://testserver/users/email_change/confirm/', confirmation_url)
        # Django 3.x以降、urlsafe_base64_encodeは文字列を返すので.decode()は不要
        encoded_email = urlsafe_base64_encode(force_bytes(custom_email))
        self.assertIn(encoded_email, confirmation_url)

    def test_verify_confirmation_tokens_with_valid_token(self):
        """有効なトークンでの確認トークン検証テスト"""
        # Django 3.x以降、urlsafe_base64_encodeは文字列を返すので.decode()は不要
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)

        verified_user = SecurityUtils.verify_confirmation_tokens(uid, token)

        # 正しいユーザーが返されることを確認
        self.assertEqual(verified_user.id, self.user.id)
        self.assertEqual(verified_user.email, self.user.email)

    def test_verify_confirmation_tokens_with_invalid_token(self):
        """無効なトークンでの確認トークン検証テスト"""
        # Django 3.x以降、urlsafe_base64_encodeは文字列を返すので.decode()は不要
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        invalid_token = 'invalid-token-12345'

        verified_user = SecurityUtils.verify_confirmation_tokens(uid, invalid_token)

        # Noneが返されることを確認
        self.assertIsNone(verified_user)

    def test_verify_confirmation_tokens_with_invalid_base64(self):
        """無効なbase64でのトークン検証テスト"""
        invalid_uid = 'not-a-valid-base64!!!'
        token = default_token_generator.make_token(self.user)

        verified_user = SecurityUtils.verify_confirmation_tokens(invalid_uid, token)

        # Noneが返されることを確認
        self.assertIsNone(verified_user)

    def test_verify_confirmation_tokens_with_nonexistent_user(self):
        """存在しないユーザーIDでのトークン検証テスト"""
        # 存在しないユーザーID（9999）を使用
        # Django 3.x以降、urlsafe_base64_encodeは文字列を返すので.decode()は不要
        nonexistent_uid = urlsafe_base64_encode(force_bytes(9999))
        token = default_token_generator.make_token(self.user)

        verified_user = SecurityUtils.verify_confirmation_tokens(nonexistent_uid, token)

        # Noneが返されることを確認
        self.assertIsNone(verified_user)

    def test_verify_confirmation_tokens_with_email_parameter(self):
        """メールアドレスパラメータ付きでの確認トークン検証テスト"""
        # Django 3.x以降、urlsafe_base64_encodeは文字列を返すので.decode()は不要
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        new_email = 'newemail@example.com'
        encoded_email = urlsafe_base64_encode(force_bytes(new_email))

        verified_user, decoded_email = SecurityUtils.verify_confirmation_tokens(
            uid, token, email=encoded_email
        )

        # ユーザーと新しいメールアドレスが正しく返されることを確認
        self.assertEqual(verified_user.id, self.user.id)
        self.assertEqual(decoded_email, new_email)

    def test_verify_confirmation_tokens_with_invalid_email_encoding(self):
        """無効なメールアドレスエンコーディングでの検証テスト"""
        # Django 3.x以降、urlsafe_base64_encodeは文字列を返すので.decode()は不要
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        invalid_email = 'not-valid-base64!!!'

        verified_user, decoded_email = SecurityUtils.verify_confirmation_tokens(
            uid, token, email=invalid_email
        )

        # 両方Noneが返されることを確認
        self.assertIsNone(verified_user)
        self.assertIsNone(decoded_email)

    def test_generate_and_verify_tokens_workflow(self):
        """トークン生成から検証までのワークフローテスト"""
        request = self.factory.get('/')
        request.META['HTTP_HOST'] = 'testserver'

        # トークン生成
        confirmation_url = SecurityUtils.generate_confirmation_tokens(
            self.user,
            request,
            'users:signup_confirm'
        )

        # URLからuidとtokenを抽出
        # URL形式: http://testserver/users/signup/confirm/uid/token/email/
        url_parts = confirmation_url.rstrip('/').split('/')
        # 末尾から: email, token, uid
        email = url_parts[-1]
        token = url_parts[-2]
        uid = url_parts[-3]

        # トークン検証
        verified_user = SecurityUtils.verify_confirmation_tokens(uid, token)

        # 正しいユーザーが返されることを確認
        self.assertIsNotNone(verified_user)
        self.assertEqual(verified_user.id, self.user.id)

    def test_verify_confirmation_tokens_with_modified_user_data(self):
        """ユーザーデータが変更された後のトークン検証テスト"""
        # Django 3.x以降、urlsafe_base64_encodeは文字列を返すので.decode()は不要
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)

        # ユーザーのパスワードを変更（トークンを無効化）
        self.user.set_password('newpassword123')
        self.user.save()

        verified_user = SecurityUtils.verify_confirmation_tokens(uid, token)

        # トークンが無効化されているためNoneが返されることを確認
        self.assertIsNone(verified_user)


class SecurityUtilsEdgeCaseTestCase(BaseTestCase):
    """SecurityUtilsのエッジケーステスト"""

    def setUp(self):
        """テスト用の準備"""
        super().setUp()
        self.factory = RequestFactory()
        self.user = create_test_user()

    def test_get_client_ip_with_ipv6_address(self):
        """IPv6アドレスの取得テスト"""
        request = self.factory.get('/')
        request.META['REMOTE_ADDR'] = '2001:db8::1'

        ip = SecurityUtils.get_client_ip(request)

        self.assertEqual(ip, '2001:db8::1')

    def test_get_client_ip_with_whitespace_in_x_forwarded_for(self):
        """X-Forwarded-Forヘッダーに空白がある場合のテスト"""
        request = self.factory.get('/')
        request.META['HTTP_X_FORWARDED_FOR'] = ' 192.168.1.1 , 10.0.0.1 '
        request.META['REMOTE_ADDR'] = '127.0.0.1'

        ip = SecurityUtils.get_client_ip(request)

        # 空白がトリムされたIPアドレスが返されることを確認
        self.assertEqual(ip.strip(), '192.168.1.1')

    def test_verify_confirmation_tokens_with_empty_strings(self):
        """空文字列でのトークン検証テスト"""
        verified_user = SecurityUtils.verify_confirmation_tokens('', '')

        # Noneが返されることを確認
        self.assertIsNone(verified_user)

    def test_generate_confirmation_tokens_with_special_characters_in_url(self):
        """URLに特殊文字が含まれる場合のトークン生成テスト"""
        request = self.factory.get('/')
        request.META['HTTP_HOST'] = 'testserver'
        special_email = 'test+special@example.com'

        confirmation_url = SecurityUtils.generate_confirmation_tokens(
            self.user,
            request,
            'users:email_change_confirm',
            email=special_email
        )

        # URLが正常に生成されることを確認
        self.assertIn('http://testserver', confirmation_url)
        # URLエンコーディングにより特殊文字が含まれることを確認
        # Django 3.x以降、urlsafe_base64_encodeは文字列を返すので.decode()は不要
        encoded_special_email = urlsafe_base64_encode(force_bytes(special_email))
        self.assertIn(encoded_special_email, confirmation_url)
