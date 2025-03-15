from django.test import TestCase
from django.urls import reverse
from unittest.mock import MagicMock, patch
from users.models import User
import json


class StripePaymentTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='securepassword123'
        )
        self.user.is_active = True
        self.user.save()

        login_success = self.client.login(username='test@example.com', password='securepassword123')
        self.assertTrue(login_success)

    @patch("purchase.views.stripe.checkout.Session.create")
    def test_create_checkout_session(self, mock_stripe_session):
        """StripeのCheckoutセッションが正しく作成されるかをテスト"""
        # mockを作成
        mock_session = MagicMock()
        mock_session.url = reverse("purchase:checkout_success")  # `url` 属性を持たせる
        mock_stripe_session.return_value = mock_session  # オブジェクトを返すようにする

        response = self.client.post(reverse('purchase:create_checkout_session'))

        # 期待されるURLにリダイレクトされることを確認
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse("purchase:checkout_success"))

    def test_webhook_preset_limit_update(self):
        """Webhookを受けた後にプリセット枠が増えているかテスト"""
        self.user.preset_limit = 10
        self.user.save()

        event_data = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "metadata": {"user_id": str(self.user.id)}  # `user_id` を設定
                }
            }
        }

        response = self.client.post(
            reverse('purchase:webhook'),
            data=json.dumps(event_data),
            content_type="application/json"
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.preset_limit, 11)

    def test_invalid_webhook_event(self):
        """不正なWebhookイベントが送信された場合の処理をテスト"""
        invalid_event_data = {
            "type": "invalid.event",  # 不明なイベントタイプで送信させる
            "data": {
                "object": {}
            }
        }
        response = self.client.post(
            reverse('purchase:webhook'),
            data=json.dumps(invalid_event_data),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)  # 400 Bad Request
        self.assertJSONEqual(response.content.decode('utf-8'), {"error": "Unhandled event type"})
