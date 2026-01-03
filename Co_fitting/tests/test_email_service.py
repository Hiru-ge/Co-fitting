from django.test import TestCase, RequestFactory
from django.core import mail
from django.contrib.auth import get_user_model
from django.conf import settings
from unittest.mock import patch, MagicMock
import threading
import time
from Co_fitting.services.email_service import EmailService
from Co_fitting.tests.helpers import create_test_user, BaseTestCase
from Co_fitting.utils.constants import AppConstants

User = get_user_model()


class EmailServiceTestCase(BaseTestCase):
    """EmailServiceクラスのテスト"""

    def setUp(self):
        """テスト用ユーザーとリクエストファクトリの準備"""
        super().setUp()
        self.factory = RequestFactory()
        self.user = create_test_user()

    def test_send_signup_confirmation_email_content(self):
        """サインアップ確認メールの内容テスト"""
        confirmation_link = 'http://testserver/users/signup/confirm/test-uid/test-token/test-email/'

        EmailService.send_signup_confirmation_email(self.user, confirmation_link)

        # メールが送信されたことを確認
        self.assertEqual(len(mail.outbox), 1)

        # メールの内容を確認
        email = mail.outbox[0]
        self.assertEqual(email.subject, 'アカウント登録の確認')
        self.assertIn(self.user.username, email.body)
        self.assertIn(confirmation_link, email.body)
        self.assertEqual(email.from_email, settings.DEFAULT_FROM_EMAIL)
        self.assertEqual(email.to, [self.user.email])

    def test_send_login_notification_email_content(self):
        """ログイン通知メールの内容テスト"""
        ip_address = '192.168.1.1'

        EmailService.send_login_notification_email(self.user, ip_address)

        # メールが送信されたことを確認
        self.assertEqual(len(mail.outbox), 1)

        # メールの内容を確認
        email = mail.outbox[0]
        self.assertEqual(email.subject, 'ログイン通知')
        self.assertIn(self.user.username, email.body)
        self.assertIn(ip_address, email.body)
        self.assertIn('日時:', email.body)
        self.assertIn('IPアドレス:', email.body)
        self.assertEqual(email.from_email, settings.DEFAULT_FROM_EMAIL)
        self.assertEqual(email.to, [self.user.email])

    def test_send_login_notification_async_threading(self):
        """非同期ログイン通知メールのスレッド処理テスト"""
        ip_address = '192.168.1.1'

        # スレッドの開始前のアクティブスレッド数を取得
        initial_thread_count = threading.active_count()

        # 非同期メール送信を実行
        EmailService.send_login_notification_async(self.user, ip_address)

        # スレッドの完了を待つ（最大1秒）
        time.sleep(0.5)

        # メールが送信されたことを確認
        self.assertEqual(len(mail.outbox), 1)

        # メールの内容を確認
        email = mail.outbox[0]
        self.assertEqual(email.subject, 'ログイン通知')
        self.assertIn(ip_address, email.body)

    def test_send_email_change_confirmation_email_content(self):
        """メールアドレス変更確認メールの内容テスト"""
        new_email = 'newemail@example.com'
        confirmation_link = 'http://testserver/users/email-change/confirm/test-uid/test-token/test-email/'

        EmailService.send_email_change_confirmation_email(self.user, new_email, confirmation_link)

        # メールが送信されたことを確認
        self.assertEqual(len(mail.outbox), 1)

        # メールの内容を確認
        email = mail.outbox[0]
        self.assertEqual(email.subject, 'メールアドレス変更の確認')
        self.assertIn(self.user.username, email.body)
        self.assertIn(new_email, email.body)
        self.assertIn(confirmation_link, email.body)
        self.assertEqual(email.from_email, settings.DEFAULT_FROM_EMAIL)
        # 新しいメールアドレスに送信されることを確認
        self.assertEqual(email.to, [new_email])

    def test_send_payment_success_email_content(self):
        """支払い成功メールの内容テスト（後方互換性）"""
        self.user.plan_type = AppConstants.PLAN_BASIC
        self.user.save()

        EmailService.send_payment_success_email(self.user)

        # メールが送信されたことを確認
        self.assertEqual(len(mail.outbox), 1)

        # メールの内容を確認（新しいメソッドにリダイレクトされる）
        email = mail.outbox[0]
        self.assertIn('【Co-fitting】', email.subject)
        self.assertIn(self.user.username, email.body)
        self.assertEqual(email.from_email, settings.DEFAULT_FROM_EMAIL)
        self.assertEqual(email.to, [self.user.email])

    def test_send_subscription_created_email_content(self):
        """初回サブスクリプション登録メールの内容テスト"""
        plan_type = AppConstants.PLAN_PREMIUM

        EmailService.send_subscription_created_email(self.user, plan_type)

        # メールが送信されたことを確認
        self.assertEqual(len(mail.outbox), 1)

        # メールの内容を確認
        email = mail.outbox[0]
        self.assertEqual(email.subject, '【Co-fitting】プレミアムプランへのご登録ありがとうございます')
        self.assertIn(self.user.username, email.body)
        self.assertIn('プレミアムプラン', email.body)
        self.assertIn('プリセットレシピ保存数: 10個', email.body)
        self.assertIn('レシピ共有数: 10個', email.body)
        self.assertIn('PiP（ピクチャーインピクチャー）機能: 利用可能', email.body)
        self.assertEqual(email.from_email, settings.DEFAULT_FROM_EMAIL)
        self.assertEqual(email.to, [self.user.email])

    def test_send_subscription_renewed_email_content(self):
        """継続課金成功メールの内容テスト"""
        plan_type = AppConstants.PLAN_BASIC

        EmailService.send_subscription_renewed_email(self.user, plan_type)

        # メールが送信されたことを確認
        self.assertEqual(len(mail.outbox), 1)

        # メールの内容を確認
        email = mail.outbox[0]
        self.assertEqual(email.subject, '【Co-fitting】ベーシックプランの継続課金が完了しました')
        self.assertIn(self.user.username, email.body)
        self.assertIn('ベーシックプラン', email.body)
        self.assertIn('決済が正常に完了いたしました', email.body)
        self.assertEqual(email.from_email, settings.DEFAULT_FROM_EMAIL)
        self.assertEqual(email.to, [self.user.email])

    def test_send_plan_upgraded_email_content(self):
        """プランアップグレードメールの内容テスト"""
        old_plan_type = AppConstants.PLAN_BASIC
        new_plan_type = AppConstants.PLAN_PREMIUM

        EmailService.send_plan_upgraded_email(self.user, old_plan_type, new_plan_type)

        # メールが送信されたことを確認
        self.assertEqual(len(mail.outbox), 1)

        # メールの内容を確認
        email = mail.outbox[0]
        self.assertEqual(email.subject, '【Co-fitting】プレミアムプランへのアップグレードが完了しました')
        self.assertIn(self.user.username, email.body)
        self.assertIn('ベーシックプラン', email.body)
        self.assertIn('プレミアムプラン', email.body)
        self.assertIn('アップグレードが完了しました', email.body)
        self.assertIn('プリセットレシピ保存数: 10個', email.body)
        self.assertIn('PiP（ピクチャーインピクチャー）機能: 利用可能', email.body)
        self.assertEqual(email.from_email, settings.DEFAULT_FROM_EMAIL)
        self.assertEqual(email.to, [self.user.email])

    def test_send_plan_downgraded_email_content(self):
        """プランダウングレードメールの内容テスト"""
        old_plan_type = AppConstants.PLAN_PREMIUM
        new_plan_type = AppConstants.PLAN_BASIC
        deleted_presets_count = 3
        deleted_shares_count = 2

        EmailService.send_plan_downgraded_email(
            self.user, old_plan_type, new_plan_type,
            deleted_presets_count, deleted_shares_count
        )

        # メールが送信されたことを確認
        self.assertEqual(len(mail.outbox), 1)

        # メールの内容を確認
        email = mail.outbox[0]
        self.assertEqual(email.subject, '【Co-fitting】ベーシックプランへの変更が完了しました')
        self.assertIn(self.user.username, email.body)
        self.assertIn('プレミアムプラン', email.body)
        self.assertIn('ベーシックプラン', email.body)
        self.assertIn('プリセットレシピ: 新しく作成された3個のレシピが削除されました', email.body)
        self.assertIn('共有レシピ: 新しく作成された2個の共有レシピが削除されました', email.body)
        self.assertIn('古いレシピは保持されています', email.body)
        self.assertEqual(email.from_email, settings.DEFAULT_FROM_EMAIL)
        self.assertEqual(email.to, [self.user.email])

    def test_send_plan_downgraded_email_without_deletion(self):
        """データ削除なしのダウングレードメールテスト"""
        old_plan_type = AppConstants.PLAN_PREMIUM
        new_plan_type = AppConstants.PLAN_BASIC

        EmailService.send_plan_downgraded_email(
            self.user, old_plan_type, new_plan_type,
            deleted_presets_count=0, deleted_shares_count=0
        )

        # メールが送信されたことを確認
        self.assertEqual(len(mail.outbox), 1)

        # メールの内容を確認
        email = mail.outbox[0]
        # 削除通知が含まれないことを確認
        self.assertNotIn('削除されました', email.body)

    def test_send_subscription_canceled_email_content(self):
        """サブスクリプションキャンセルメールの内容テスト"""
        from datetime import datetime, timedelta
        period_end_date = datetime.now() + timedelta(days=15)

        EmailService.send_subscription_canceled_email(self.user, period_end_date)

        # メールが送信されたことを確認
        self.assertEqual(len(mail.outbox), 1)

        # メールの内容を確認
        email = mail.outbox[0]
        self.assertEqual(email.subject, '【Co-fitting】サブスクリプションの解約が完了しました')
        self.assertIn(self.user.username, email.body)
        self.assertIn('解約手続きが完了しました', email.body)
        self.assertIn('フリープラン', email.body)
        self.assertIn('までご利用いただけます', email.body)
        self.assertEqual(email.from_email, settings.DEFAULT_FROM_EMAIL)
        self.assertEqual(email.to, [self.user.email])

    def test_send_subscription_canceled_email_without_period_end(self):
        """期間終了日なしのキャンセルメールテスト"""
        EmailService.send_subscription_canceled_email(self.user, period_end_date=None)

        # メールが送信されたことを確認
        self.assertEqual(len(mail.outbox), 1)

        # メールの内容を確認
        email = mail.outbox[0]
        self.assertIn('解約手続きが完了しました', email.body)

    def test_send_payment_failed_email_with_request(self):
        """支払い失敗メールのリクエスト処理テスト"""
        request = self.factory.get('/')
        request.META['HTTP_HOST'] = 'testserver'

        EmailService.send_payment_failed_email(self.user, request)

        # メールが送信されたことを確認
        self.assertEqual(len(mail.outbox), 1)

        # メールの内容を確認
        email = mail.outbox[0]
        self.assertEqual(email.subject, '【Co-fitting】お支払いに失敗しました')
        self.assertIn(self.user.username, email.body)
        self.assertIn('決済処理に失敗しました', email.body)
        self.assertIn('考えられる原因', email.body)
        self.assertIn('対処方法', email.body)
        self.assertIn('http://testserver/mypage/', email.body)
        self.assertEqual(email.from_email, settings.DEFAULT_FROM_EMAIL)
        self.assertEqual(email.to, [self.user.email])

    def test_email_sending_failure_handling(self):
        """メール送信失敗時のエラーハンドリングテスト"""
        with patch('Co_fitting.services.email_service.send_mail') as mock_send_mail:
            # send_mailが例外を発生させるように設定
            mock_send_mail.side_effect = Exception('メール送信エラー')

            # 例外が発生することを確認
            with self.assertRaises(Exception) as context:
                EmailService.send_signup_confirmation_email(
                    self.user,
                    'http://testserver/confirm/'
                )

            self.assertIn('メール送信エラー', str(context.exception))


class EmailServiceEdgeCaseTestCase(BaseTestCase):
    """EmailServiceのエッジケーステスト"""

    def setUp(self):
        """テスト用の準備"""
        super().setUp()
        self.factory = RequestFactory()
        self.user = create_test_user()

    def test_send_email_with_long_username(self):
        """長いユーザー名でのメール送信テスト"""
        self.user.username = 'a' * 150  # 長いユーザー名
        self.user.save()

        EmailService.send_signup_confirmation_email(
            self.user,
            'http://testserver/confirm/'
        )

        # メールが送信されたことを確認
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertIn(self.user.username, email.body)

    def test_send_email_with_special_characters_in_username(self):
        """特殊文字を含むユーザー名でのメール送信テスト"""
        self.user.username = 'test@user#123'
        self.user.save()

        EmailService.send_login_notification_email(self.user, '192.168.1.1')

        # メールが送信されたことを確認
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertIn(self.user.username, email.body)

    def test_send_email_change_confirmation_with_unicode_email(self):
        """Unicode文字を含むメールアドレスでの変更確認メールテスト"""
        # 国際化メールアドレス（実際には使用は推奨されない）
        new_email = 'test@例.com'

        EmailService.send_email_change_confirmation_email(
            self.user,
            new_email,
            'http://testserver/confirm/'
        )

        # メールが送信されたことを確認
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertIn(new_email, email.body)

    def test_send_email_with_ipv6_address(self):
        """IPv6アドレスでのログイン通知メールテスト"""
        ipv6_address = '2001:db8::1'

        EmailService.send_login_notification_email(self.user, ipv6_address)

        # メールが送信されたことを確認
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertIn(ipv6_address, email.body)

    def test_send_email_with_empty_confirmation_link(self):
        """空の確認リンクでのメール送信テスト"""
        EmailService.send_signup_confirmation_email(self.user, '')

        # メールが送信されたことを確認
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        # 空のリンクでもメールが送信されることを確認
        self.assertIn('アカウント登録の確認', email.subject)

    def test_send_payment_failed_email_with_https_request(self):
        """HTTPSリクエストでの支払い失敗メールテスト"""
        request = self.factory.get('/')
        request.META['HTTP_HOST'] = 'testserver'
        request.META['wsgi.url_scheme'] = 'https'
        request.is_secure = lambda: True

        EmailService.send_payment_failed_email(self.user, request)

        # メールが送信されたことを確認
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        # HTTPSでのURLが含まれることを確認
        self.assertIn('mypage', email.body)

    def test_send_multiple_emails_in_sequence(self):
        """複数のメールを連続して送信するテスト"""
        # ユーザーにplan_typeを設定
        self.user.plan_type = AppConstants.PLAN_BASIC
        self.user.save()

        # 複数のメールを連続して送信
        EmailService.send_signup_confirmation_email(self.user, 'http://testserver/confirm1/')
        EmailService.send_login_notification_email(self.user, '192.168.1.1')
        EmailService.send_payment_success_email(self.user)

        # 3通のメールが送信されたことを確認
        self.assertEqual(len(mail.outbox), 3)

        # 各メールの件名を確認
        subjects = [email.subject for email in mail.outbox]
        self.assertIn('アカウント登録の確認', subjects)
        self.assertIn('ログイン通知', subjects)
        # send_payment_success_emailは新しいメソッドにリダイレクトされる
        self.assertTrue(any('【Co-fitting】' in subject for subject in subjects))

    def test_send_login_notification_async_multiple_times(self):
        """複数回の非同期ログイン通知メール送信テスト"""
        ip_addresses = ['192.168.1.1', '192.168.1.2', '192.168.1.3']

        # 複数の非同期メール送信を実行
        for ip in ip_addresses:
            EmailService.send_login_notification_async(self.user, ip)

        # すべてのスレッドの完了を待つ
        time.sleep(1)

        # 3通のメールが送信されたことを確認
        self.assertEqual(len(mail.outbox), 3)

        # 各IPアドレスが含まれることを確認
        email_bodies = [email.body for email in mail.outbox]
        for ip in ip_addresses:
            self.assertTrue(any(ip in body for body in email_bodies))

    @patch('Co_fitting.services.email_service.send_mail')
    def test_email_service_uses_correct_from_email(self, mock_send_mail):
        """すべてのメール送信で正しい送信元アドレスが使用されることをテスト"""
        # 各メソッドを実行
        request = self.factory.get('/')
        request.META['HTTP_HOST'] = 'testserver'

        self.user.plan_type = AppConstants.PLAN_BASIC
        self.user.save()

        EmailService.send_signup_confirmation_email(self.user, 'http://test/')
        EmailService.send_login_notification_email(self.user, '192.168.1.1')
        EmailService.send_email_change_confirmation_email(self.user, 'new@example.com', 'http://test/')
        EmailService.send_subscription_created_email(self.user, AppConstants.PLAN_BASIC)
        EmailService.send_subscription_renewed_email(self.user, AppConstants.PLAN_BASIC)
        EmailService.send_plan_upgraded_email(self.user, AppConstants.PLAN_BASIC, AppConstants.PLAN_PREMIUM)
        EmailService.send_plan_downgraded_email(self.user, AppConstants.PLAN_PREMIUM, AppConstants.PLAN_BASIC)
        EmailService.send_payment_failed_email(self.user, request)
        EmailService.send_subscription_canceled_email(self.user, None)

        # すべての呼び出しで settings.DEFAULT_FROM_EMAIL が使用されていることを確認
        for call in mock_send_mail.call_args_list:
            args, _ = call
            # send_mailの第3引数がfrom_email
            self.assertEqual(args[2], settings.DEFAULT_FROM_EMAIL)

    def test_send_email_with_very_long_confirmation_link(self):
        """非常に長い確認リンクでのメール送信テスト"""
        # 長いURLを生成
        long_url = 'http://testserver/confirm/' + 'a' * 1000

        EmailService.send_signup_confirmation_email(self.user, long_url)

        # メールが送信されたことを確認
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        # 長いURLが含まれることを確認
        self.assertIn(long_url, email.body)
