from django.test import TestCase
from django.core import mail
from django.urls import reverse
from users.models import User


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

        confirmation_url = mail.outbox[0].body.split('a href="')[1].split('">')[0]  # メール内の確認URLを取得
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

    def test_signup_sends_confirmation_email(self):
        """サインアップリクエスト時に確認メールが送信されるかテスト"""
        self.client.post(self.signup_request_url, {
            'username': 'testuser',
            'email': 'test@example.com',
            'password1': 'securepassword123',
            'password2': 'securepassword123'
        })
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('サインアップ確認', mail.outbox[0].subject)

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
            password='securepassword123'
        )

    def test_valid_login(self):
        """正しいメールアドレスとパスワードでログインできることをテスト"""
        response = self.client.post(self.login_url, {
            'username': 'test@example.com',
            'password': 'securepassword123'
        })
        self.assertEqual(response.status_code, 200)

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

        response = self.client.post(self.login_url, {
            'username': 'inactive@example.com',
            'password': 'securepassword123'
        })
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "メールアドレスまたはパスワードが正しくありません")


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

        self.change_email_url = reverse('users:change_email_request')

    def test_user_can_email_change(self):
        """正常にメールアドレス変更ができるかテスト"""
        # メール送信
        new_email = 'new@example.com'
        self.client.post(self.change_email_url, {'email': new_email})
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('メールアドレス変更確認', mail.outbox[0].subject)

        # メール内の確認URLを取得・変更を確認
        confirmation_url = mail.outbox[0].body.split('a href="')[1].split('">')[0]
        response = self.client.get(confirmation_url)

        self.assertEqual(response.status_code, 302)  # 成功時のリダイレクト確認
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, new_email)  # メールアドレスが変更されたか

    def test_user_cannot_change_to_existing_email(self):
        """すでに登録されているメールアドレスには変更できないか"""
        User.objects.create_user(username='otheruser', email='taken@example.com', password='password123')

        response = self.client.post(self.change_email_url, {'email': 'taken@example.com'})
        self.assertEqual(response.status_code, 200)  # フォームを再表示
        self.assertContains(response, "このメールアドレスは既に使用されています")

    def test_invalid_confirmation_link(self):
        """無効な確認リンクにアクセスした場合の挙動をテスト"""
        invalid_url = reverse('users:change_email_confirm', kwargs={'uidb64': 'invalid', 'token': 'invalid', 'email': 'invalid'})
        response = self.client.get(invalid_url)

        # サインアップリクエストページにリダイレクトされることを確認
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse('users:change_email_request'))


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

        success = self.client.login(username='test@example.com', password='oldpassword123')
        self.assertTrue(success)    # ログインが成功したかチェック

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
