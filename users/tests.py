from django.test import TestCase
from django.core import mail
from django.urls import reverse
from users.models import User
from django.utils import timezone
from datetime import timedelta
from django.core.management import call_command


class SignUpTestCase(TestCase):
    def setUp(self):
        self.signup_request_url = reverse('users:signup_request')

    def test_user_can_signup(self):
        """正常にサインアップできるか"""
        response = self.client.post(self.signup_request_url, {
            'username': 'testuser',
            'email': 'test@example.com',
            'password1': 'securepassword123',
            'password2': 'securepassword123'
        })
        self.assertEqual(response.status_code, 302)

        # メール本文をプレーンテキストとして解析し、確認URLを抽出
        email_body = mail.outbox[0].body
        confirmation_url = next(line for line in email_body.split("\n") if "http" in line).strip()
        self.assertTrue(User.objects.filter(username='testuser').exists())

        response = self.client.get(confirmation_url)
        self.assertEqual(response.status_code, 302)

        # アカウントが有効化されることを確認
        user = User.objects.get(username='testuser')
        self.assertTrue(user.is_active)

    def test_duplicate_email_signup_fails(self):
        """既存のメールアドレスでは登録できないことをテスト"""
        User.objects.create_user(username='existinguser', email='test@example.com', password='password123')
        response = self.client.post(self.signup_request_url, {
            'username': 'newuser',
            'email': 'test@example.com',
            'password1': 'securepassword123',
            'password2': 'securepassword123'
        })
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "入力内容を確認してください")

    def test_invalid_confirmation_link(self):
        """無効な確認リンクにアクセスした場合の挙動をテスト"""
        invalid_url = reverse('users:signup_confirm', kwargs={'uidb64': 'invalid', 'token': 'invalid', 'email': 'invalid'})
        response = self.client.get(invalid_url)

        # サインアップリクエストページにリダイレクトされることを確認
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse('users:signup_request'))


class LoginTestCase(TestCase):
    def setUp(self):
        """テスト用ユーザー作成"""
        self.login_url = reverse('users:login')
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='securepassword123',
        )
        self.user.is_active = True
        self.user.save()

    def test_valid_login(self):
        """正しいメールアドレスとパスワードでログインできることをテスト"""
        response = self.client.post(self.login_url, {
            'username': 'test@example.com',
            'password': 'securepassword123'
        })
        self.assertTrue(response)   # ログインが成功すればTrueが入っている
        self.assertEqual(response.status_code, 302)     # マイページにリダイレクト

    def test_invalid_password_login(self):
        """間違ったパスワードではログインできないことをテスト"""
        response = self.client.post(self.login_url, {
            'username': 'test@example.com',
            'password': 'wrongpassword'
        })
        self.assertEqual(response.status_code, 200)  # フォームを再表示
        self.assertContains(response, "メールアドレスまたはパスワードが正しくありません")

    def test_invalid_email_login(self):
        """存在しないメールアドレスではログインできないことをテスト"""
        response = self.client.post(self.login_url, {
            'username': 'notexist@example.com',
            'password': 'securepassword123'
        })
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "メールアドレスまたはパスワードが正しくありません")

    def test_inactive_user_cannot_login(self):
        """無効化されたユーザーはログインできないことをテスト"""
        inactive_user = User.objects.create_user(
            username='inactiveuser',
            email='inactive@example.com',
            password='securepassword123',
        )
        inactive_user.is_active = False     # 無効化
        self.user.save()

        response = self.client.post(self.login_url, {
            'username': 'inactive@example.com',
            'password': 'securepassword123'
        })
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "メールアドレスまたはパスワードが正しくありません")

    def test_login_notification_mail_send(self):
        """ログイン時にメール通知が行われることを確認"""
        self.client.post(self.login_url, {
            'username': 'test@example.com',
            'password': 'securepassword123'
        })
        self.assertEqual(len(mail.outbox), 1)  # メールが送信されていることを確認


class LogoutTestCase(TestCase):
    def setUp(self):
        """テストユーザーを作成してログイン"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='securepassword123'
        )
        self.user.is_active = True
        self.user.save()
        # indexでDefaultPresetが居ることを前提とした処理があるので、テストにも追加する必要がある
        self.default_preset_user = User.objects.create_user(
            username='DefaultPreset',
            email='default@example.com',
            password='defaultpassword123'
        )
        self.default_preset_user.is_active = True
        self.default_preset_user.save()

        self.login_url = reverse('users:login')
        self.logout_url = reverse('users:logout')
        login_success = self.client.login(username='test@example.com', password='securepassword123')
        self.assertTrue(login_success)    # ログインが成功したかチェック

    def test_user_can_logout(self):
        """ログアウトが正常に行われることをテスト"""
        response = self.client.post(self.logout_url)
        self.assertRedirects(response, self.login_url)  # ログアウト後はログイン画面へリダイレクト

        # セッションがクリアされていることを確認
        self.assertNotIn('_auth_user_id', self.client.session)

    def test_access_protected_page_after_logout(self):
        """ログアウト後に保護されたページへアクセスできないことをテスト"""
        self.client.post(self.logout_url)  # まずログアウト
        response = self.client.get(reverse('recipes:mypage'))  # マイページなど保護ページにアクセス
        self.assertRedirects(response, f"{reverse('users:login')}?next={reverse('recipes:mypage')}")


class EmailChangeTestCase(TestCase):
    def setUp(self):
        """テスト用ユーザー作成・有効化 & ログイン"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='securepassword123'
        )
        self.user.is_active = True
        self.user.save()

        success = self.client.login(username='test@example.com', password='securepassword123')
        self.assertTrue(success)    # ログインが成功したかチェック

        self.email_change_url = reverse('users:email_change_request')

    def test_user_can_email_change(self):
        """正常にメールアドレス変更ができるかテスト"""
        # メール送信
        new_email = 'new@example.com'
        self.client.post(self.email_change_url, {'email': new_email})
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('メールアドレス変更確認', mail.outbox[0].subject)

        # メール本文をプレーンテキストとして解析し、確認URLを抽出
        email_body = mail.outbox[0].body
        confirmation_url = next(line for line in email_body.split("\n") if "http" in line).strip()
        response = self.client.get(confirmation_url)

        self.assertEqual(response.status_code, 302)  # 成功時のリダイレクト確認
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, new_email)  # メールアドレスが変更されたか

    def test_user_cannot_change_to_existing_email(self):
        """すでに登録されているメールアドレスには変更できないか"""
        User.objects.create_user(username='otheruser', email='taken@example.com', password='password123')

        response = self.client.post(self.email_change_url, {'email': 'taken@example.com'})
        self.assertEqual(response.status_code, 200)  # フォームを再表示
        self.assertContains(response, "このメールアドレスは既に使用されています")

    def test_invalid_confirmation_link(self):
        """無効な確認リンクにアクセスした場合の挙動をテスト"""
        invalid_url = reverse('users:email_change_confirm', kwargs={'uidb64': 'invalid', 'token': 'invalid', 'email': 'invalid'})
        response = self.client.get(invalid_url)

        # サインアップリクエストページにリダイレクトされることを確認
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse('users:email_change_request'))


class PasswordChangeTestCase(TestCase):
    def setUp(self):
        """テスト用ユーザー作成・有効化 & ログイン"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='oldpassword123'
        )
        self.user.is_active = True
        self.user.save()

        login_success = self.client.login(username='test@example.com', password='oldpassword123')
        self.assertTrue(login_success)    # ログインが成功したかチェック

        self.password_change_url = reverse("users:password_change")

    def user_can_password_change(self):
        """正常にパスワード変更できるか"""
        response = self.client.post(self.password_change_url, {
            "old_password": "oldpassword123",
            "new_password1": "newpassword123",
            "new_password2": "newpassword123",
        })
        self.assertEqual(response.status_code, 302)  # リダイレクトされることを確認
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("newpassword123"))  # パスワード変更が適用されているか

    def test_password_change_fails_with_wrong_old_password(self):
        """現在のパスワードが間違っていた場合は変更できないことをテスト"""
        response = self.client.post(self.password_change_url, {
            "old_password": "wrongpassword",
            "new_password1": "newpassword123",
            "new_password2": "newpassword123",
        })
        self.assertEqual(response.status_code, 200)  # 失敗時はフォームが再表示される
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("oldpassword123"))  # パスワードが変更されていないか確認

    def test_login_with_new_password_after_change(self):
        """変更後、新しいパスワードでログインできるか"""
        # まずパスワード変更
        self.client.post(self.password_change_url, {
            "old_password": "oldpassword123",
            "new_password1": "newpassword123",
            "new_password2": "newpassword123",
        })

        # ログアウトして新しいパスワードでログイン
        self.client.logout()
        login_success = self.client.login(username="test@example.com", password="newpassword123")
        self.assertTrue(login_success)  # 新しいパスワードでログインできるか確認


class PasswordResetTestCase(TestCase):
    def setUp(self):
        """テスト用ユーザー作成・有効化 & ログイン"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='securepassword123'
        )
        self.user.is_active = True
        self.user.save()

        login_success = self.client.login(username='test@example.com', password='securepassword123')
        self.assertTrue(login_success)    # ログインが成功したかチェック

        self.password_reset_url = reverse("users:password_reset")

    def test_user_can_password_reset(self):
        """正常にパスワードリセットができるかテスト"""
        response = self.client.post(self.password_reset_url, {
            'email': 'test@example.com',
        })
        self.assertRedirects(response, reverse('users:password_reset_done'))

        # メール本文をプレーンテキストとして解析し、確認URLを抽出
        email_body = mail.outbox[0].body
        confirmation_url = next(line for line in email_body.split("\n") if "http" in line).strip()
        response = self.client.get(confirmation_url)
        password_enter_url = response.url   # リダイレクト先であるパスワード入力ページのURLを取得

        response = self.client.post(password_enter_url, {
            "new_password1": "newpassword123",
            "new_password2": "newpassword123",
        })
        self.assertRedirects(response, reverse('users:password_reset_complete'))
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("newpassword123"))  # パスワードが変更されているか確認

    def test_invalid_email_login(self):
        """存在しないメールアドレスでリクエストしても、メールが送信されないことを確認"""
        response = self.client.post(self.password_reset_url, {
            'email': 'nonexistent@example.com',
        })
        self.assertRedirects(response, reverse('users:password_reset_done'))  # 成功時と同じリダイレクトが起こる
        self.assertEqual(len(mail.outbox), 0)  # メールが送信されていないことを確認


class AccountDeleteTestCase(TestCase):
    def setUp(self):
        # indexでDefaultPresetが居ることを前提とした処理があるので、テストにも追加する必要があった
        self.default_preset_user = User.objects.create_user(
            username='DefaultPreset',
            email='default@example.com',
            password='defaultpassword123'
        )
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='securepassword123'
        )
        self.user.is_active = True
        self.user.save()
        login_success = self.client.login(username='test@example.com', password='securepassword123')
        self.assertTrue(login_success)
        self.delete_account_url = reverse('users:account_delete')

    def test_user_cannot_login_after_deletion(self):
        """退会処理後、非アクティブになりログインできなくなることをテスト"""
        response = self.client.post(self.delete_account_url)
        self.assertRedirects(response, reverse('index'))  # 退会後のリダイレクト先は変換ページ

        # ユーザーが非アクティブになっているか確認
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

        # ログインを試みて失敗することを確認
        login_successful = self.client.login(username='test@example.com', password='securepassword123')
        self.assertFalse(login_successful)

    def test_user_data_after_deletion(self):
        """退会後にユーザーデータが論理削除されていることをテスト"""
        self.client.post(self.delete_account_url)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

    def test_inactive_user_deletion(self):
        """一定期間(30日)を過ぎた非アクティブユーザーが削除されることをテスト"""
        self.user.is_active = False
        self.user.deactivated_at = timezone.now() - timedelta(days=31)
        self.user.save()

        # コマンドを実行して非アクティブユーザーを削除
        call_command('delete_inactive_users')

        # ユーザーが削除されていることを確認
        with self.assertRaises(User.DoesNotExist):
            User.objects.get(username='testuser')
