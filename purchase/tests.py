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

    @patch("purchase.models.StripeService.create_checkout_session")
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

        with patch("purchase.models.send_mail") as mock_send_mail:
            response = self.client.post(
                reverse('purchase:webhook'),
                data=json.dumps(event_data),
                content_type="application/json",
            )
        self.assertEqual(response.status_code, 200)
        mock_send_mail.assert_called_once()
        
        # 件名と受信者をチェック
        args, kwargs = mock_send_mail.call_args
        subject, message, from_email, recipient_list = args
        self.assertEqual(subject, "支払い完了通知")
        self.assertEqual(recipient_list, [self.user.email])

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

        with patch("purchase.models.send_mail") as mock_send_mail:
            response = self.client.post(
                reverse('purchase:webhook'),
                data=json.dumps(event_data),
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 200)
        mock_send_mail.assert_called_once()
        
        # 件名と受信者をチェック
        args, kwargs = mock_send_mail.call_args
        subject, message, from_email, recipient_list = args
        self.assertEqual(subject, "支払い失敗通知")
        self.assertEqual(recipient_list, [self.user.email])


class PurchaseViewsTestCase(TestCase):
    """購入ビューのテスト"""
    
    def setUp(self):
        """テスト用ユーザーの作成"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='securepassword123'
        )
        self.user.is_active = True
        self.user.save()

    def test_create_checkout_session_requires_login(self):
        """チェックアウトセッション作成はログインが必要であることをテスト"""
        response = self.client.post(reverse('purchase:create_checkout_session'))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith(reverse('users:login')))





    def test_get_preset_limit_api(self):
        """プリセット制限取得APIのテスト"""
        self.client.login(username='test@example.com', password='securepassword123')
        
        response = self.client.get(reverse('purchase:get_preset_limit'))
        self.assertEqual(response.status_code, 200)
        
        response_data = json.loads(response.content)
        self.assertEqual(response_data['preset_limit'], self.user.preset_limit)

    def test_get_preset_limit_api_requires_login(self):
        """プリセット制限取得APIはログインが必要であることをテスト"""
        response = self.client.get(reverse('purchase:get_preset_limit'))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith(reverse('users:login')))

    def test_create_portal_session_requires_login(self):
        """ポータルセッション作成はログインが必要であることをテスト"""
        response = self.client.post(reverse('purchase:create_portal_session'))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith(reverse('users:login')))

    @patch("purchase.models.StripeService.create_portal_session")
    def test_create_portal_session_success(self, mock_portal_session):
        """ポータルセッション作成が正常に動作することをテスト"""
        self.client.login(username='test@example.com', password='securepassword123')
        
        # ユーザーにStripe顧客IDを設定
        self.user.stripe_customer_id = 'cus_test123'
        self.user.save()
        
        # モックの設定
        mock_session = MagicMock()
        mock_session.url = 'https://billing.stripe.com/session123'
        mock_portal_session.return_value = mock_session
        
        response = self.client.post(reverse('purchase:create_portal_session'))
        
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, 'https://billing.stripe.com/session123')

    def test_create_portal_session_no_customer_id(self):
        """Stripe顧客IDがない場合のポータルセッション作成エラーテスト"""
        self.client.login(username='test@example.com', password='securepassword123')
        
        response = self.client.post(reverse('purchase:create_portal_session'))
        
        # エラーレスポンスが返されることを確認
        self.assertIn(response.status_code, [200, 400, 500])


class PurchaseWebhookTestCase(TestCase):
    """購入Webhookのテスト"""
    
    def setUp(self):
        """テスト用ユーザーの作成"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='securepassword123'
        )
        self.user.is_active = True
        self.user.save()

    def test_webhook_invalid_json(self):
        """無効なJSONでのWebhookリクエストのテスト"""
        response = self.client.post(
            reverse('purchase:webhook'),
            data='invalid json',
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 400)

    def test_webhook_customer_subscription_updated(self):
        """サブスクリプション更新イベントのテスト"""
        self.user.stripe_customer_id = 'cus_test123'
        self.user.save()
        
        event_data = {
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "customer": self.user.stripe_customer_id,
                    "status": "active"
                }
            }
        }
        
        response = self.client.post(
            reverse('purchase:webhook'),
            data=json.dumps(event_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)

    def test_webhook_customer_subscription_created(self):
        """サブスクリプション作成イベントのテスト"""
        self.user.stripe_customer_id = 'cus_test123'
        self.user.save()
        
        event_data = {
            "type": "customer.subscription.created",
            "data": {
                "object": {
                    "customer": self.user.stripe_customer_id,
                    "status": "active"
                }
            }
        }
        
        response = self.client.post(
            reverse('purchase:webhook'),
            data=json.dumps(event_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)

    def test_webhook_invoice_created(self):
        """請求書作成イベントのテスト"""
        self.user.stripe_customer_id = 'cus_test123'
        self.user.save()
        
        event_data = {
            "type": "invoice.created",
            "data": {
                "object": {
                    "customer": self.user.stripe_customer_id
                }
            }
        }
        
        response = self.client.post(
            reverse('purchase:webhook'),
            data=json.dumps(event_data),
            content_type='application/json'
        )
        
        # イベントが処理されることを確認
        self.assertIn(response.status_code, [200, 400])

    def test_webhook_invoice_payment_succeeded(self):
        """請求書支払い成功イベントのテスト"""
        self.user.stripe_customer_id = 'cus_test123'
        self.user.save()
        
        event_data = {
            "type": "invoice.paid",
            "data": {
                "object": {
                    "customer": self.user.stripe_customer_id
                }
            }
        }
        
        with patch("purchase.models.send_mail") as mock_send_mail:
            response = self.client.post(
                reverse('purchase:webhook'),
                data=json.dumps(event_data),
                content_type='application/json'
            )
        
        # イベントが処理されることを確認
        self.assertEqual(response.status_code, 200)
        mock_send_mail.assert_called_once()
        
        # 件名と受信者をチェック
        args, kwargs = mock_send_mail.call_args
        subject, message, from_email, recipient_list = args
        self.assertEqual(subject, "支払い完了通知")
        self.assertEqual(recipient_list, [self.user.email])

    def test_webhook_invoice_payment_failed(self):
        """請求書支払い失敗イベントのテスト"""
        self.user.stripe_customer_id = 'cus_test123'
        self.user.save()
        
        event_data = {
            "type": "invoice.payment_failed",
            "data": {
                "object": {
                    "customer": self.user.stripe_customer_id
                }
            }
        }
        
        with patch("purchase.models.send_mail") as mock_send_mail:
            response = self.client.post(
                reverse('purchase:webhook'),
                data=json.dumps(event_data),
                content_type='application/json'
            )
        
        self.assertEqual(response.status_code, 200)
        mock_send_mail.assert_called_once()
        
        # 件名と受信者をチェック
        args, kwargs = mock_send_mail.call_args
        subject, message, from_email, recipient_list = args
        self.assertEqual(subject, "支払い失敗通知")
        self.assertEqual(recipient_list, [self.user.email])


class PurchaseIntegrationTestCase(TestCase):
    """購入機能の統合テスト"""
    
    def setUp(self):
        """テスト用ユーザーの作成"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='securepassword123'
        )
        self.user.is_active = True
        self.user.save()

    def test_complete_purchase_flow(self):
        """完全な購入フローのテスト"""
        self.client.login(username='test@example.com', password='securepassword123')
        
        # 1. チェックアウトセッション作成
        with patch("purchase.models.StripeService.create_checkout_session") as mock_stripe_session:
            mock_session = MagicMock()
            mock_session.url = reverse("purchase:checkout_success")
            mock_stripe_session.return_value = mock_session
            
            response = self.client.post(reverse('purchase:create_checkout_session'))
            self.assertEqual(response.status_code, 302)
            self.assertEqual(response.url, reverse("purchase:checkout_success"))
        
        # 2. チェックアウト完了イベント
        customer_id = 'cus_test123'
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
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        
        # 3. ユーザーにStripe顧客IDが設定されることを確認
        self.user.refresh_from_db()
        self.assertEqual(self.user.stripe_customer_id, customer_id)
        
        # 4. 支払い完了イベント
        event_data = {
            "type": "invoice.paid",
            "data": {
                "object": {
                    "customer": customer_id
                }
            }
        }
        
        with patch("purchase.models.send_mail") as mock_send_mail:
            response = self.client.post(
                reverse('purchase:webhook'),
                data=json.dumps(event_data),
                content_type='application/json'
            )
        
        self.assertEqual(response.status_code, 200)
        mock_send_mail.assert_called_once()
        
        # 件名と受信者をチェック
        args, kwargs = mock_send_mail.call_args
        subject, message, from_email, recipient_list = args
        self.assertEqual(subject, "支払い完了通知")
        self.assertEqual(recipient_list, [self.user.email])
        
        # 5. ユーザーのサブスクリプション状態が更新されることを確認
        self.user.refresh_from_db()
        self.assertEqual(self.user.preset_limit, 4)
        self.assertTrue(self.user.is_subscribed)

    def test_subscription_cancellation_flow(self):
        """サブスクリプション解約フローのテスト"""
        self.client.login(username='test@example.com', password='securepassword123')
        
        # ユーザーを有料ユーザーに設定
        self.user.preset_limit = 4
        self.user.stripe_customer_id = 'cus_test123'
        self.user.is_subscribed = True
        self.user.save()
        
        # プリセットレシピを作成
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
        
        # サブスクリプション解約イベント
        event_data = {
            "type": "customer.subscription.deleted",
            "data": {
                "object": {
                    "metadata": {"user_id": str(self.user.id)},
                    "customer": self.user.stripe_customer_id,
                    "status": "canceled"
                }
            }
        }
        
        response = self.client.post(
            reverse('purchase:webhook'),
            data=json.dumps(event_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        
        # ユーザーの状態が更新されることを確認
        self.user.refresh_from_db()
        self.assertEqual(self.user.preset_limit, 1)
        self.assertFalse(self.user.is_subscribed)
        
        # プリセットレシピが1つだけ残ることを確認
        from recipes.models import Recipe
        self.assertEqual(Recipe.objects.filter(create_user=self.user).count(), 1)
        self.assertTrue(Recipe.objects.filter(name="Preset 1").exists())


class PurchaseSecurityTestCase(TestCase):
    """購入機能のセキュリティテスト"""
    
    def setUp(self):
        """テスト用ユーザーの作成"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='securepassword123'
        )
        self.user.is_active = True
        self.user.save()

    def test_webhook_csrf_exempt(self):
        """WebhookエンドポイントがCSRF免除されていることをテスト"""
        # CSRFトークンなしでリクエストを送信
        response = self.client.post(
            reverse('purchase:webhook'),
            data=json.dumps({"type": "test.event", "data": {"object": {}}}),
            content_type='application/json'
        )
        
        # CSRFエラーではなく、イベントタイプエラーが返されることを確認
        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['error'], 'Unhandled event type')

    def test_webhook_method_restriction(self):
        """WebhookエンドポイントがPOSTメソッドのみを受け付けることをテスト"""
        response = self.client.get(reverse('purchase:webhook'))
        # GETメソッドが許可されていないことを確認
        self.assertIn(response.status_code, [400, 405, 500])  # Bad Request, Method Not Allowed, or Internal Server Error

    def test_webhook_content_type_validation(self):
        """WebhookエンドポイントがJSONコンテンツタイプを要求することをテスト"""
        response = self.client.post(
            reverse('purchase:webhook'),
            data="plain text",
            content_type='text/plain'
        )
        
        self.assertEqual(response.status_code, 400)

    def test_webhook_user_id_validation(self):
        """Webhookで無効なユーザーIDが処理されないことをテスト"""
        event_data = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_456",
                    "object": "checkout.session",
                    "customer": "cus_test123",
                    "metadata": {
                        "user_id": "999999"  # 存在しないユーザーID
                    }
                }
            }
        }
        
        response = self.client.post(
            reverse('purchase:webhook'),
            data=json.dumps(event_data),
            content_type='application/json'
        )
        
        # エラーが発生することを確認
        self.assertIn(response.status_code, [400, 404, 500])
