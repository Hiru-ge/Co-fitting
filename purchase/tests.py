from django.test import TestCase
from django.urls import reverse
from unittest.mock import MagicMock, patch
from users.models import User
from recipes.models import Recipe, RecipeStep
import json


class StripePaymentTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='securepassword123'
        )
        self.user.is_active = True
        self.user.stripe_customer_id = 'cus_test123'
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
        self.user.preset_limit = 1
        self.user.save()

        event_data = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "metadata": {"user_id": str(self.user.id)},  # `user_id` を設定
                    "customer": self.user.stripe_customer_id,
                    "status": "active",
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
        self.assertEqual(self.user.preset_limit, 4)
        self.assertTrue(self.user.is_subscribed)

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

    def test_subscription_expired_cleanup(self):
        """サブスク期限が切れたときにプリセット枠が1つになり、マイプリセットが1つ残して削除されることをテスト"""
        self.user.preset_limit = 3
        self.user.is_subscribed = True
        self.user.save()

        # MyPresetを3つ作成
        for i in range(3):
            self.recipe = Recipe.objects.create(
                name=f"Preset {i+1}",
                create_user=self.user,
                is_ice=False,
                len_steps=2,
                bean_g=20,
                water_ml=200,
                memo="編集前のメモ"
            )
            RecipeStep.objects.create(
                recipe_id=self.recipe,
                step_number=1,
                minute=0,
                seconds=0,
                total_water_ml_this_step=30,
            )
            RecipeStep.objects.create(
                recipe_id=self.recipe,
                step_number=2,
                minute=1,
                seconds=20,
                total_water_ml_this_step=150,
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
        self.assertFalse(self.user.is_subscribed)   # サブスクリプションがキャンセルされたことを確認
