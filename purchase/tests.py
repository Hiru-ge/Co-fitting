from django.test import TestCase
from django.urls import reverse
from unittest.mock import MagicMock, patch
from users.models import User
from recipes.models import Recipe, RecipeStep
import json


def create_mock_recipe(user, name, is_ice, len_steps, bean_g, water_ml, memo):
    Recipe.objects.create(
        name=name,
        create_user=user,
        is_ice=is_ice,
        len_steps=len_steps,
        bean_g=bean_g,
        water_ml=water_ml,
        memo=memo
    )
    for i in range(len_steps):
        RecipeStep.objects.create(
            recipe_id=Recipe.objects.last(),
            step_number=i + 1,
            minute=i,
            seconds=0,
            total_water_ml_this_step=water_ml / len_steps,
        )


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

    def test_checkout_session_completed_sets_customer_id(self):
        """checkout.session.completed イベントでユーザーにstripe_customer_idが保存されるかをテスト"""
        customer_id = 'cus_test_checkout123'
        event_data = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_456",
                    "object": "checkout.session",
                    "customer": customer_id,
                    "metadata": {
                        "user_id": str(self.user.id)
                    }
                }
            }
        }

        response = self.client.post(
            reverse('purchase:webhook'),
            data=json.dumps(event_data),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)

        self.user.refresh_from_db()
        self.assertEqual(self.user.stripe_customer_id, customer_id)

    def test_send_mail_when_payment_succeeded(self):
        """支払い成功時にメールが送信され、かつプリセット枠が増えるかをテスト"""
        self.user.stripe_customer_id = 'cus_test123'
        self.user.save()

        event_data = {
            "type": "invoice.paid",
            "data": {
                "object": {
                    "customer": self.user.stripe_customer_id,
                }
            }
        }

        with patch("purchase.views.send_mail") as mock_send_mail:
            response = self.client.post(
                reverse('purchase:webhook'),
                data=json.dumps(event_data),
                content_type="application/json",
            )
        self.assertEqual(response.status_code, 200)
        mock_send_mail.assert_called_once()
        args, kwargs = mock_send_mail.call_args
        self.assertIn("支払い完了通知", args[0])

        # プリセット枠が増えていることを確認
        self.user.refresh_from_db()
        self.assertEqual(self.user.preset_limit, 4)
        self.assertTrue(self.user.is_subscribed)

    def test_subscription_expired_cleanup(self):
        """サブスク期限が切れたときにプリセット枠が1つになり、マイプリセットが1つ残して削除されることをテスト"""
        self.user.preset_limit = 4
        self.user.stripe_customer_id = 'cus_test123'
        self.user.is_subscribed = True
        self.user.save()

        # MyPresetを3つ作成
        for i in range(3):
            create_mock_recipe(
                user=self.user,
                name=f"Preset {i + 1}",
                is_ice=False,
                len_steps=1,
                bean_g=10,
                water_ml=100,
                memo="Test recipe"
            )

        # サブスクリプションの状態を更新(Webhookにcustomer.subscription.deletedのmockを送信)
        event_data = {
            "type": "customer.subscription.deleted",
            "data": {
                "object": {
                    "metadata": {"user_id": str(self.user.id)},  # `user_id` を設定
                    "customer": self.user.stripe_customer_id,
                    "status": "canceled",
                }
            }
        }
        response = self.client.post(
            reverse('purchase:webhook'),
            data=json.dumps(event_data),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.preset_limit, 1)
        self.assertEqual(Recipe.objects.filter(create_user=self.user).count(), 1)  # ユーザーのレシピが1つだけ残っていることを確認
        self.assertTrue(Recipe.objects.filter(name="Preset 1").exists())    # 最初のレシピが残っていることを確認
        self.assertFalse(Recipe.objects.filter(name="Preset 2").exists())   # 他のレシピが削除されていることを確認
        self.assertFalse(self.user.is_subscribed)

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

    def test_send_mail_when_payment_failed(self):
        """支払い失敗時にメールが送信されるかをテスト"""
        self.user.stripe_customer_id = 'cus_test123'
        self.user.save()

        event_data = {
            "type": "invoice.payment_failed",
            "data": {
                "object": {
                    "customer": self.user.stripe_customer_id,
                }
            }
        }

        with patch("purchase.views.send_mail") as mock_send_mail:
            response = self.client.post(
                reverse('purchase:webhook'),
                data=json.dumps(event_data),
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 200)
        mock_send_mail.assert_called_once()
        args, kwargs = mock_send_mail.call_args
        self.assertIn("支払い失敗通知", args[0])
