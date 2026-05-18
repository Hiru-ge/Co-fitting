import threading
import time
from unittest.mock import patch

from django.conf import settings
from django.core import mail
from django.test import RequestFactory

from Co_fitting.services.email_service import EmailService
from Co_fitting.tests.helpers import BaseTestCase, create_test_user


class EmailServiceTestCase(BaseTestCase):
    """EmailServiceクラスのテスト"""

    def setUp(self):
        super().setUp()
        self.factory = RequestFactory()
        self.user = create_test_user()

    def test_send_signup_confirmation_email_content(self):
        confirmation_link = 'http://testserver/users/signup/confirm/test-uid/test-token/test-email/'

        EmailService.send_signup_confirmation_email(self.user, confirmation_link)

        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertEqual(email.subject, 'アカウント登録の確認')
        self.assertIn(self.user.username, email.body)
        self.assertIn(confirmation_link, email.body)
        self.assertEqual(email.from_email, settings.DEFAULT_FROM_EMAIL)
        self.assertEqual(email.to, [self.user.email])

    def test_send_login_notification_email_content(self):
        ip_address = '192.168.1.1'

        EmailService.send_login_notification_email(self.user, ip_address)

        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertEqual(email.subject, 'ログイン通知')
        self.assertIn(self.user.username, email.body)
        self.assertIn(ip_address, email.body)
        self.assertIn('日時:', email.body)
        self.assertEqual(email.from_email, settings.DEFAULT_FROM_EMAIL)
        self.assertEqual(email.to, [self.user.email])

    def test_send_login_notification_async_threading(self):
        ip_address = '192.168.1.1'
        initial_thread_count = threading.active_count()

        EmailService.send_login_notification_async(self.user, ip_address)
        time.sleep(0.5)

        self.assertGreaterEqual(threading.active_count(), initial_thread_count)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].subject, 'ログイン通知')

    def test_send_email_change_confirmation_email_content(self):
        new_email = 'newemail@example.com'
        confirmation_link = 'http://testserver/users/email-change/confirm/test-uid/test-token/test-email/'

        EmailService.send_email_change_confirmation_email(self.user, new_email, confirmation_link)

        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertEqual(email.subject, 'メールアドレス変更の確認')
        self.assertIn(self.user.username, email.body)
        self.assertIn(new_email, email.body)
        self.assertIn(confirmation_link, email.body)
        self.assertEqual(email.from_email, settings.DEFAULT_FROM_EMAIL)
        self.assertEqual(email.to, [new_email])

    @patch('Co_fitting.services.email_service.send_mail')
    def test_email_service_uses_correct_from_email(self, mock_send_mail):
        EmailService.send_signup_confirmation_email(self.user, 'http://test/')
        EmailService.send_login_notification_email(self.user, '192.168.1.1')
        EmailService.send_email_change_confirmation_email(self.user, 'new@example.com', 'http://test/')

        for call in mock_send_mail.call_args_list:
            args, _ = call
            self.assertEqual(args[2], settings.DEFAULT_FROM_EMAIL)
