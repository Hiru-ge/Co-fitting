from django.urls import reverse
from unittest.mock import MagicMock, patch
import json
from Co_fitting.tests.helpers import create_test_user, create_test_recipe, login_test_user, BaseTestCase
from recipes.models import PresetRecipe
from Co_fitting.utils.constants import AppConstants


class StripePaymentTest(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_and_login_user()

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
        """支払い成功時（継続課金）にメールが送信され、かつプリセット枠が増えるかをテスト"""
        self.user.stripe_customer_id = 'cus_test123'
        self.user.save()

        event_data = {
            "type": "invoice.paid",
            "data": {
                "object": {
                    "customer": self.user.stripe_customer_id,
                    "subscription": "sub_test123",
                    "billing_reason": "subscription_cycle",  # 継続課金
                }
            }
        }

        # Stripeのサブスクリプション取得をモック
        mock_subscription = {
            "metadata": {"plan_type": AppConstants.PLAN_BASIC},
            "items": {
                "data": [{
                    "price": {
                        "id": AppConstants.STRIPE_PRICE_IDS.get(AppConstants.PLAN_BASIC, "price_test")
                    }
                }]
            }
        }

        with patch("Co_fitting.services.email_service.send_mail") as mock_send_mail, \
             patch("stripe.Subscription.retrieve", return_value=mock_subscription):
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
        self.assertEqual(subject, "【Co-fitting】ベーシックプランの継続課金が完了しました")
        self.assertEqual(recipient_list, [self.user.email])

        # プリセット枠が増えていることを確認
        self.user.refresh_from_db()
        self.assertEqual(self.user.preset_limit_value, AppConstants.PRESET_LIMITS.get(AppConstants.PLAN_BASIC, 1))
        self.assertNotEqual(self.user.plan_type, AppConstants.PLAN_FREE)

    def test_subscription_expired_cleanup(self):
        """サブスク期限が切れたときにプリセット枠が1つになり、マイプリセットが1つ残して削除されることをテスト"""
        self.user.plan_type = AppConstants.PLAN_BASIC
        self.user.stripe_customer_id = 'cus_test123'
        self.user.save()

        # MyPresetを3つ作成
        for i in range(3):
            create_test_recipe(
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
        self.assertEqual(self.user.preset_limit_value, AppConstants.FREE_PRESET_LIMIT)
        self.assertEqual(PresetRecipe.objects.filter(created_by=self.user).count(), AppConstants.FREE_PRESET_LIMIT)  # ユーザーのレシピが1つだけ残っていることを確認
        self.assertTrue(PresetRecipe.objects.filter(name="Preset 1").exists())    # 最初のレシピが残っていることを確認
        self.assertFalse(PresetRecipe.objects.filter(name="Preset 2").exists())   # 他のレシピが削除されていることを確認
        self.assertEqual(self.user.plan_type, AppConstants.PLAN_FREE)

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
        response_data = json.loads(response.content)
        self.assertEqual(response_data['error'], 'unhandled_event')
        self.assertEqual(response_data['message'], 'Unhandled event type')

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

        with patch("Co_fitting.services.email_service.send_mail") as mock_send_mail:
            response = self.client.post(
                reverse('purchase:webhook'),
                data=json.dumps(event_data),
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 200)
        mock_send_mail.assert_called_once()

        # 件名と受信者をチェック
        args, _ = mock_send_mail.call_args
        subject, _, _, recipient_list = args
        self.assertEqual(subject, "【Co-fitting】お支払いに失敗しました")
        self.assertEqual(recipient_list, [self.user.email])


class PurchaseViewsTestCase(BaseTestCase):
    """購入ビューのテスト"""

    def setUp(self):
        """テスト用ユーザーの作成"""
        super().setUp()
        self.user = create_test_user()

    def test_create_checkout_session_requires_login(self):
        """チェックアウトセッション作成はログインが必要であることをテスト"""
        response = self.client.post(reverse('purchase:create_checkout_session'))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith(reverse('users:login')))

    def test_get_preset_limit_api(self):
        """プリセット制限取得APIのテスト"""
        login_test_user(self, user=self.user)

        response = self.client.get(reverse('purchase:get_preset_limit'))
        self.assertEqual(response.status_code, 200)

        response_data = json.loads(response.content)
        self.assertEqual(response_data['preset_limit'], self.user.preset_limit_value)

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
        login_test_user(self, user=self.user)

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
        login_test_user(self, user=self.user)

        response = self.client.post(reverse('purchase:create_portal_session'))

        # stripe_customer_idがない場合はselect_planページにリダイレクトされる
        self.assertEqual(response.status_code, 302)
        self.assertIn('select_plan', response.url)


class PurchaseWebhookTestCase(BaseTestCase):
    """購入Webhookのテスト"""

    def setUp(self):
        """テスト用ユーザーの作成"""
        super().setUp()
        self.user = create_test_user()

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
                    "status": "active",
                    "metadata": {"plan_type": AppConstants.PLAN_BASIC},
                    "items": {
                        "data": [{
                            "price": {
                                "id": AppConstants.STRIPE_PRICE_IDS.get(AppConstants.PLAN_BASIC, "price_test")
                            }
                        }]
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

    def test_webhook_customer_subscription_created(self):
        """サブスクリプション作成イベントのテスト"""
        self.user.stripe_customer_id = 'cus_test123'
        self.user.save()

        event_data = {
            "type": "customer.subscription.created",
            "data": {
                "object": {
                    "customer": self.user.stripe_customer_id,
                    "status": "active",
                    "metadata": {"plan_type": AppConstants.PLAN_BASIC},
                    "items": {
                        "data": [{
                            "price": {
                                "id": AppConstants.STRIPE_PRICE_IDS.get(AppConstants.PLAN_BASIC, "price_test")
                            }
                        }]
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
        """請求書支払い成功イベントのテスト（継続課金）"""
        self.user.stripe_customer_id = 'cus_test123'
        self.user.plan_type = AppConstants.PLAN_BASIC
        self.user.save()

        event_data = {
            "type": "invoice.paid",
            "data": {
                "object": {
                    "customer": self.user.stripe_customer_id,
                    "subscription": "sub_test123",
                    "billing_reason": "subscription_cycle",  # 継続課金
                }
            }
        }

        # Stripeのサブスクリプション取得をモック
        mock_subscription = {
            "metadata": {"plan_type": AppConstants.PLAN_BASIC},
            "items": {
                "data": [{
                    "price": {
                        "id": AppConstants.STRIPE_PRICE_IDS.get(AppConstants.PLAN_BASIC, "price_test")
                    }
                }]
            }
        }

        with patch("Co_fitting.services.email_service.send_mail") as mock_send_mail, \
             patch("stripe.Subscription.retrieve", return_value=mock_subscription):
            response = self.client.post(
                reverse('purchase:webhook'),
                data=json.dumps(event_data),
                content_type='application/json'
            )

        # イベントが処理されることを確認
        self.assertEqual(response.status_code, 200)
        mock_send_mail.assert_called_once()

        # 件名と受信者をチェック
        args, _ = mock_send_mail.call_args
        subject, _, _, recipient_list = args
        self.assertEqual(subject, "【Co-fitting】ベーシックプランの継続課金が完了しました")
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

        with patch("Co_fitting.services.email_service.send_mail") as mock_send_mail:
            response = self.client.post(
                reverse('purchase:webhook'),
                data=json.dumps(event_data),
                content_type='application/json'
            )

        self.assertEqual(response.status_code, 200)
        mock_send_mail.assert_called_once()

        # 件名と受信者をチェック
        args, _ = mock_send_mail.call_args
        subject, _, _, recipient_list = args
        self.assertEqual(subject, "【Co-fitting】お支払いに失敗しました")
        self.assertEqual(recipient_list, [self.user.email])


class PurchaseIntegrationTestCase(BaseTestCase):
    """購入機能の統合テスト"""

    def setUp(self):
        """テスト用ユーザーの作成"""
        super().setUp()
        self.user = create_test_user()

    def test_complete_purchase_flow(self):
        """完全な購入フローのテスト"""
        login_test_user(self, user=self.user)

        # 1. チェックアウトセッション作成
        with patch("purchase.models.StripeService.create_checkout_session") as mock_stripe_session:
            mock_session = MagicMock()
            mock_session.url = reverse("purchase:checkout_success")
            mock_stripe_session.return_value = mock_session

            response = self.client.post(reverse('purchase:create_checkout_session'))
            self.assertEqual(response.status_code, 302)
            self.assertEqual(response.url, reverse("purchase:checkout_success"))

        # 2. チェックアウト完了イベント（初回登録メールが送信される）
        customer_id = 'cus_test123'
        event_data = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_456",
                    "object": "checkout.session",
                    "customer": customer_id,
                    "metadata": {
                        "user_id": str(self.user.id),
                        "plan_type": AppConstants.PLAN_BASIC
                    }
                }
            }
        }

        with patch("Co_fitting.services.email_service.send_mail") as mock_send_mail:
            response = self.client.post(
                reverse('purchase:webhook'),
                data=json.dumps(event_data),
                content_type='application/json'
            )
            self.assertEqual(response.status_code, 200)

            # 初回登録メールが送信されることを確認
            mock_send_mail.assert_called_once()
            args, _ = mock_send_mail.call_args
            subject, _, _, recipient_list = args
            self.assertEqual(subject, "【Co-fitting】ベーシックプランへのご登録ありがとうございます")
            self.assertEqual(recipient_list, [self.user.email])

        # 3. ユーザーにStripe顧客IDが設定されることを確認
        self.user.refresh_from_db()
        self.assertEqual(self.user.stripe_customer_id, customer_id)
        self.assertEqual(self.user.plan_type, AppConstants.PLAN_BASIC)

        # 4. 初回支払い完了イベント（billing_reason='subscription_create'なのでメール送信なし）
        event_data = {
            "type": "invoice.paid",
            "data": {
                "object": {
                    "customer": customer_id,
                    "subscription": "sub_test123",
                    "billing_reason": "subscription_create",  # 初回課金
                }
            }
        }

        # Stripeのサブスクリプション取得をモック
        mock_subscription = {
            "metadata": {"plan_type": AppConstants.PLAN_BASIC},
            "items": {
                "data": [{
                    "price": {
                        "id": AppConstants.STRIPE_PRICE_IDS.get(AppConstants.PLAN_BASIC, "price_test")
                    }
                }]
            }
        }

        with patch("Co_fitting.services.email_service.send_mail") as mock_send_mail, \
             patch("stripe.Subscription.retrieve", return_value=mock_subscription):
            response = self.client.post(
                reverse('purchase:webhook'),
                data=json.dumps(event_data),
                content_type='application/json'
            )

            self.assertEqual(response.status_code, 200)
            # 初回課金なので、メールは送信されない（checkout.session.completedで既に送信済み）
            mock_send_mail.assert_not_called()

        # 5. ユーザーのサブスクリプション状態が更新されることを確認
        self.user.refresh_from_db()
        self.assertEqual(self.user.preset_limit_value, AppConstants.PRESET_LIMITS.get(AppConstants.PLAN_BASIC, 1))
        self.assertNotEqual(self.user.plan_type, AppConstants.PLAN_FREE)

    def test_subscription_cancellation_flow(self):
        """サブスクリプション解約フローのテスト"""
        login_test_user(self, user=self.user)

        # ユーザーを有料ユーザーに設定
        self.user.plan_type = AppConstants.PLAN_BASIC
        self.user.stripe_customer_id = 'cus_test123'
        self.user.save()

        # プリセットレシピを作成
        for i in range(3):
            create_test_recipe(
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
        self.assertEqual(self.user.preset_limit_value, 1)
        self.assertEqual(self.user.plan_type, AppConstants.PLAN_FREE)

        # プリセットレシピが1つだけ残ることを確認
        self.assertEqual(PresetRecipe.objects.filter(created_by=self.user).count(), 1)
        self.assertTrue(PresetRecipe.objects.filter(name="Preset 1").exists())


class PurchaseSecurityTestCase(BaseTestCase):
    """購入機能のセキュリティテスト"""

    def setUp(self):
        """テスト用ユーザーの作成"""
        super().setUp()
        self.user = create_test_user()

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
        self.assertEqual(response_data['error'], 'unhandled_event')

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


class StripeServiceTestCase(BaseTestCase):
    """StripeServiceクラスの詳細テスト"""

    def setUp(self):
        """テスト用ユーザーの作成"""
        super().setUp()
        self.user = create_test_user()

    @patch('stripe.checkout.Session.create')
    def test_create_checkout_session_with_custom_plan(self, mock_create):
        """カスタムプランタイプでのチェックアウトセッション作成テスト"""
        from purchase.models import StripeService
        from django.test import RequestFactory

        factory = RequestFactory()
        request = factory.post('/')
        request.META['HTTP_HOST'] = 'testserver'

        mock_session = MagicMock()
        mock_session.id = 'cs_test_123'
        mock_create.return_value = mock_session

        session = StripeService.create_checkout_session(
            self.user, request, AppConstants.PLAN_BASIC
        )

        self.assertEqual(session.id, 'cs_test_123')
        mock_create.assert_called_once()

    @patch('stripe.checkout.Session.create')
    def test_create_checkout_session_invalid_plan_type(self, mock_create):
        """無効なプランタイプでのチェックアウトセッション作成エラーテスト"""
        from purchase.models import StripeService
        from django.test import RequestFactory

        factory = RequestFactory()
        request = factory.post('/')

        with self.assertRaises(Exception) as context:
            StripeService.create_checkout_session(self.user, request, 'invalid_plan')

        self.assertIn('Invalid plan type', str(context.exception))

    @patch('stripe.checkout.Session.create')
    def test_create_checkout_session_stripe_api_error(self, mock_create):
        """Stripe APIエラー時のチェックアウトセッション作成エラーテスト"""
        from purchase.models import StripeService
        from django.test import RequestFactory
        import stripe

        factory = RequestFactory()
        request = factory.post('/')

        mock_create.side_effect = stripe.error.APIError('API Error')

        with self.assertRaises(Exception) as context:
            StripeService.create_checkout_session(
                self.user, request, AppConstants.PLAN_BASIC
            )

        self.assertIn('Stripe checkout session creation failed', str(context.exception))

    @patch('stripe.Subscription.retrieve')
    @patch('stripe.Subscription.modify')
    def test_change_subscription_plan_success(self, mock_modify, mock_retrieve):
        """サブスクリプションプラン変更の成功テスト"""
        from purchase.models import StripeService

        # モックのサブスクリプション設定（辞書とオブジェクト属性の両方をサポート）
        mock_item = MagicMock()
        mock_item.id = 'si_test123'

        mock_subscription = MagicMock()
        mock_subscription.id = 'sub_test123'
        mock_subscription.__getitem__ = lambda self, key: {'id': 'sub_test123', 'items': {'data': [mock_item]}}[key]
        mock_subscription['items'] = {'data': [mock_item]}
        mock_retrieve.return_value = mock_subscription

        result = StripeService.change_subscription_plan('sub_test123', AppConstants.PLAN_BASIC)

        # 結果がモックサブスクリプションであることを確認
        self.assertEqual(result.id, 'sub_test123')
        mock_retrieve.assert_called_once_with('sub_test123')
        mock_modify.assert_called_once()

    @patch('stripe.Subscription.retrieve')
    def test_change_subscription_plan_invalid_plan(self, mock_retrieve):
        """無効なプランタイプでのサブスクリプション変更エラーテスト"""
        from purchase.models import StripeService

        with self.assertRaises(Exception) as context:
            StripeService.change_subscription_plan('sub_test123', 'invalid_plan')

        self.assertIn('Invalid plan type', str(context.exception))

    @patch('stripe.Subscription.retrieve')
    def test_change_subscription_plan_stripe_error(self, mock_retrieve):
        """Stripe APIエラー時のサブスクリプション変更エラーテスト"""
        from purchase.models import StripeService
        import stripe

        mock_retrieve.side_effect = stripe.error.APIError('API Error')

        with self.assertRaises(Exception) as context:
            StripeService.change_subscription_plan('sub_test123', AppConstants.PLAN_BASIC)

        self.assertIn('Stripe subscription plan change failed', str(context.exception))

    def test_get_plan_type_from_price_id_basic(self):
        """Price IDからBASICプランタイプを判別するテスト"""
        from purchase.models import StripeService

        price_id = AppConstants.STRIPE_PRICE_IDS.get(AppConstants.PLAN_BASIC)
        plan_type = StripeService.get_plan_type_from_price_id(price_id)

        self.assertEqual(plan_type, AppConstants.PLAN_BASIC)

    def test_get_plan_type_from_price_id_unknown(self):
        """不明なPrice IDでNoneが返されることをテスト"""
        from purchase.models import StripeService

        plan_type = StripeService.get_plan_type_from_price_id('price_unknown_123')

        self.assertIsNone(plan_type)

    @patch('stripe.billing_portal.Session.create')
    def test_create_portal_session_success(self, mock_create):
        """ポータルセッション作成の成功テスト"""
        from purchase.models import StripeService

        mock_session = MagicMock()
        mock_session.url = 'https://billing.stripe.com/session123'
        mock_create.return_value = mock_session

        session = StripeService.create_portal_session(
            'cus_test123',
            'http://testserver/mypage/'
        )

        self.assertEqual(session.url, 'https://billing.stripe.com/session123')
        mock_create.assert_called_once()

    @patch('stripe.billing_portal.Session.create')
    def test_create_portal_session_stripe_error(self, mock_create):
        """Stripe APIエラー時のポータルセッション作成エラーテスト"""
        from purchase.models import StripeService
        import stripe

        mock_create.side_effect = stripe.error.APIError('API Error')

        with self.assertRaises(Exception) as context:
            StripeService.create_portal_session('cus_test123', 'http://testserver/')

        self.assertIn('Stripe portal session creation failed', str(context.exception))


class ChangePlanViewTestCase(BaseTestCase):
    """プラン変更ビューのテスト"""

    def setUp(self):
        """テスト用ユーザーの作成"""
        super().setUp()
        self.user = create_test_user()

    def test_change_plan_requires_login(self):
        """プラン変更にログインが必要であることをテスト"""
        response = self.client.post(
            reverse('purchase:change_plan'),
            data=json.dumps({'plan_type': AppConstants.PLAN_BASIC}),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith(reverse('users:login')))

    def test_change_plan_invalid_plan_type(self):
        """無効なプランタイプでのプラン変更エラーテスト"""
        login_test_user(self, user=self.user)

        response = self.client.post(
            reverse('purchase:change_plan'),
            data=json.dumps({'plan_type': 'invalid_plan'}),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content)
        self.assertIn('error', response_data)

    def test_change_plan_same_plan_error(self):
        """同じプランへの変更エラーテスト"""
        login_test_user(self, user=self.user)

        self.user.plan_type = AppConstants.PLAN_BASIC
        self.user.save()

        response = self.client.post(
            reverse('purchase:change_plan'),
            data=json.dumps({'plan_type': AppConstants.PLAN_BASIC}),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content)
        self.assertIn('既に同じプラン', response_data['error'])

    @patch('purchase.models.StripeService.create_checkout_session')
    def test_change_plan_from_free_creates_checkout(self, mock_create_session):
        """FREEプランからのアップグレードでチェックアウトセッションが作成されることをテスト"""
        login_test_user(self, user=self.user)

        mock_session = MagicMock()
        mock_session.url = 'https://checkout.stripe.com/session123'
        mock_create_session.return_value = mock_session

        response = self.client.post(
            reverse('purchase:change_plan'),
            data=json.dumps({'plan_type': AppConstants.PLAN_BASIC}),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        self.assertIn('checkout_url', response_data)
        self.assertEqual(response_data['checkout_url'], mock_session.url)

    @patch('stripe.Subscription.list')
    @patch('purchase.models.StripeService.create_checkout_session')
    def test_change_plan_no_active_subscription_creates_checkout(
        self, mock_create_session, mock_subscription_list
    ):
        """アクティブなサブスクリプションがない場合にチェックアウトが作成されることをテスト"""
        login_test_user(self, user=self.user)

        self.user.stripe_customer_id = 'cus_test123'
        self.user.plan_type = AppConstants.PLAN_BASIC
        self.user.save()

        # アクティブなサブスクリプションがない
        mock_subscription_list.return_value = MagicMock(data=[])

        mock_session = MagicMock()
        mock_session.url = 'https://checkout.stripe.com/session123'
        mock_create_session.return_value = mock_session

        response = self.client.post(
            reverse('purchase:change_plan'),
            data=json.dumps({'plan_type': AppConstants.PLAN_PREMIUM}),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        self.assertIn('checkout_url', response_data)

    @patch('stripe.Subscription.list')
    @patch('purchase.models.StripeService.change_subscription_plan')
    def test_change_plan_upgrade_success(self, mock_change_plan, mock_subscription_list):
        """プランアップグレードの成功テスト"""
        login_test_user(self, user=self.user)

        self.user.stripe_customer_id = 'cus_test123'
        self.user.plan_type = AppConstants.PLAN_BASIC
        self.user.save()

        # アクティブなサブスクリプションがある
        mock_subscription = MagicMock()
        mock_subscription.id = 'sub_test123'
        mock_subscription_list.return_value = MagicMock(data=[mock_subscription])

        response = self.client.post(
            reverse('purchase:change_plan'),
            data=json.dumps({'plan_type': AppConstants.PLAN_PREMIUM}),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        self.assertTrue(response_data['success'])

        # ユーザーのプランが更新されることを確認
        self.user.refresh_from_db()
        self.assertEqual(self.user.plan_type, AppConstants.PLAN_PREMIUM)

    @patch('stripe.Subscription.list')
    @patch('purchase.models.StripeService.change_subscription_plan')
    def test_change_plan_downgrade_success(self, mock_change_plan, mock_subscription_list):
        """プランダウングレードの成功テスト"""
        login_test_user(self, user=self.user)

        self.user.stripe_customer_id = 'cus_test123'
        self.user.plan_type = AppConstants.PLAN_PREMIUM
        self.user.save()

        # プリセットレシピを複数作成
        for i in range(5):
            create_test_recipe(
                user=self.user,
                name=f"Preset {i + 1}",
                is_ice=False,
                len_steps=1,
                bean_g=10,
                water_ml=100,
                memo="Test recipe"
            )

        # アクティブなサブスクリプションがある
        mock_subscription = MagicMock()
        mock_subscription.id = 'sub_test123'
        mock_subscription_list.return_value = MagicMock(data=[mock_subscription])

        response = self.client.post(
            reverse('purchase:change_plan'),
            data=json.dumps({'plan_type': AppConstants.PLAN_BASIC}),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        self.assertTrue(response_data['success'])

        # ユーザーのプランが更新されることを確認
        self.user.refresh_from_db()
        self.assertEqual(self.user.plan_type, AppConstants.PLAN_BASIC)

        # プリセットレシピが制限内に削減されることを確認
        preset_count = PresetRecipe.objects.filter(created_by=self.user).count()
        self.assertLessEqual(preset_count, AppConstants.PRESET_LIMITS.get(AppConstants.PLAN_BASIC, 1))

    def test_change_plan_invalid_json(self):
        """無効なJSONでのプラン変更エラーテスト"""
        login_test_user(self, user=self.user)

        response = self.client.post(
            reverse('purchase:change_plan'),
            data='invalid json',
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content)
        self.assertIn('error', response_data)


class DowngradeCleanupTestCase(BaseTestCase):
    """ダウングレード時のクリーンアップ処理テスト"""

    def setUp(self):
        """テスト用ユーザーの作成"""
        super().setUp()
        self.user = create_test_user()

    def test_downgrade_cleanup_deletes_excess_presets(self):
        """ダウングレード時に超過プリセットが削除されることをテスト"""
        from purchase.models import SubscriptionManager

        self.user.plan_type = AppConstants.PLAN_PREMIUM
        self.user.save()

        # プリセットレシピを5つ作成
        for i in range(5):
            create_test_recipe(
                user=self.user,
                name=f"Preset {i + 1}",
                is_ice=False,
                len_steps=1,
                bean_g=10,
                water_ml=100,
                memo="Test recipe"
            )

        initial_count = PresetRecipe.objects.filter(created_by=self.user).count()
        self.assertEqual(initial_count, 5)

        # BASICプランにダウングレード
        SubscriptionManager._handle_plan_downgrade_cleanup(
            self.user,
            AppConstants.PLAN_PREMIUM,
            AppConstants.PLAN_BASIC
        )

        # プリセットが制限内に削減されることを確認
        final_count = PresetRecipe.objects.filter(created_by=self.user).count()
        self.assertEqual(final_count, AppConstants.PRESET_LIMITS.get(AppConstants.PLAN_BASIC, 1))

        # 古いレシピが残されることを確認
        self.assertTrue(PresetRecipe.objects.filter(name="Preset 1").exists())

    def test_downgrade_cleanup_deletes_excess_shared_recipes(self):
        """ダウングレード時に超過共有レシピが削除されることをテスト"""
        from purchase.models import SubscriptionManager
        from recipes.models import SharedRecipe

        self.user.plan_type = AppConstants.PLAN_PREMIUM
        self.user.save()

        # 共有レシピを5つ作成
        for i in range(5):
            SharedRecipe.objects.create(
                name=f"Shared Recipe {i + 1}",
                created_by=self.user,
                is_ice=False,
                len_steps=1,
                bean_g=10,
                water_ml=100,
                memo="Shared recipe",
                access_token=f"token_{i + 1}"
            )

        initial_count = SharedRecipe.objects.filter(created_by=self.user).count()
        self.assertEqual(initial_count, 5)

        # BASICプランにダウングレード
        SubscriptionManager._handle_plan_downgrade_cleanup(
            self.user,
            AppConstants.PLAN_PREMIUM,
            AppConstants.PLAN_BASIC
        )

        # 共有レシピが制限内に削減されることを確認
        final_count = SharedRecipe.objects.filter(created_by=self.user).count()
        self.assertEqual(final_count, AppConstants.SHARE_LIMITS.get(AppConstants.PLAN_BASIC, 1))

    def test_downgrade_cleanup_no_deletion_when_within_limit(self):
        """制限内の場合はダウングレード時に削除されないことをテスト"""
        from purchase.models import SubscriptionManager

        self.user.plan_type = AppConstants.PLAN_BASIC
        self.user.save()

        # プリセットレシピを1つだけ作成
        create_test_recipe(
            user=self.user,
            name="Preset 1",
            is_ice=False,
            len_steps=1,
            bean_g=10,
            water_ml=100,
            memo="Test recipe"
        )

        initial_count = PresetRecipe.objects.filter(created_by=self.user).count()
        self.assertEqual(initial_count, 1)

        # FREEプランにダウングレード（制限は同じ1）
        SubscriptionManager._handle_plan_downgrade_cleanup(
            self.user,
            AppConstants.PLAN_BASIC,
            AppConstants.PLAN_FREE
        )

        # レシピが削除されないことを確認
        final_count = PresetRecipe.objects.filter(created_by=self.user).count()
        self.assertEqual(final_count, 1)

    def test_downgrade_cleanup_handles_zero_recipes(self):
        """レシピが0個の場合のダウングレード処理をテスト"""
        from purchase.models import SubscriptionManager

        self.user.plan_type = AppConstants.PLAN_PREMIUM
        self.user.save()

        # レシピを作成しない
        initial_count = PresetRecipe.objects.filter(created_by=self.user).count()
        self.assertEqual(initial_count, 0)

        # BASICプランにダウングレード
        SubscriptionManager._handle_plan_downgrade_cleanup(
            self.user,
            AppConstants.PLAN_PREMIUM,
            AppConstants.PLAN_BASIC
        )

        # エラーが発生しないことを確認
        final_count = PresetRecipe.objects.filter(created_by=self.user).count()
        self.assertEqual(final_count, 0)

    def test_downgrade_cleanup_no_action_on_upgrade(self):
        """アップグレード時は削除処理が行われないことをテスト"""
        from purchase.models import SubscriptionManager

        self.user.plan_type = AppConstants.PLAN_BASIC
        self.user.save()

        # プリセットレシピを3つ作成
        for i in range(3):
            create_test_recipe(
                user=self.user,
                name=f"Preset {i + 1}",
                is_ice=False,
                len_steps=1,
                bean_g=10,
                water_ml=100,
                memo="Test recipe"
            )

        initial_count = PresetRecipe.objects.filter(created_by=self.user).count()
        self.assertEqual(initial_count, 3)

        # PREMIUMプランにアップグレード
        SubscriptionManager._handle_plan_downgrade_cleanup(
            self.user,
            AppConstants.PLAN_BASIC,
            AppConstants.PLAN_PREMIUM
        )

        # レシピが削除されないことを確認
        final_count = PresetRecipe.objects.filter(created_by=self.user).count()
        self.assertEqual(final_count, 3)


class AdditionalPurchaseViewsTestCase(BaseTestCase):
    """追加の購入ビューのテスト"""

    def setUp(self):
        """テスト用ユーザーの作成"""
        super().setUp()
        self.user = create_test_user()

    def test_get_current_plan_success(self):
        """現在のプラン情報取得の成功テスト"""
        login_test_user(self, user=self.user)

        response = self.client.get(reverse('purchase:get_current_plan'))

        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        self.assertIn('plan_type', response_data)
        self.assertIn('preset_limit', response_data)
        self.assertIn('share_limit', response_data)
        self.assertEqual(response_data['plan_type'], self.user.plan_type)

    def test_get_current_plan_requires_login(self):
        """現在のプラン情報取得にログインが必要であることをテスト"""
        response = self.client.get(reverse('purchase:get_current_plan'))

        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith(reverse('users:login')))

    def test_select_plan_page_renders(self):
        """プラン選択ページが正常に表示されることをテスト"""
        login_test_user(self, user=self.user)

        response = self.client.get(reverse('purchase:select_plan'))

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'purchase/select_plan.html')

    def test_select_plan_requires_login(self):
        """プラン選択ページにログインが必要であることをテスト"""
        response = self.client.get(reverse('purchase:select_plan'))

        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith(reverse('users:login')))

    def test_already_subscribed_redirects_to_select_plan(self):
        """already_subscribedページがselect_planにリダイレクトすることをテスト"""
        login_test_user(self, user=self.user)

        response = self.client.get(reverse('purchase:already_subscribed'))

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse('purchase:select_plan'))

    def test_not_subscribed_redirects_to_select_plan(self):
        """not_subscribedページがselect_planにリダイレクトすることをテスト"""
        login_test_user(self, user=self.user)

        response = self.client.get(reverse('purchase:not_subscribed'))

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse('purchase:select_plan'))

    def test_create_checkout_session_with_invalid_plan_type(self):
        """無効なプランタイプでのチェックアウトセッション作成エラーテスト"""
        login_test_user(self, user=self.user)

        response = self.client.post(
            reverse('purchase:create_checkout_session') + '?plan_type=invalid_plan'
        )

        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['error'], 'invalid_plan')

    def test_create_checkout_session_already_subscribed_error(self):
        """既にサブスクリプション中のユーザーがエラーを受け取ることをテスト"""
        login_test_user(self, user=self.user)

        self.user.plan_type = AppConstants.PLAN_BASIC
        self.user.stripe_customer_id = 'cus_test123'
        self.user.save()

        response = self.client.post(reverse('purchase:create_checkout_session'))

        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['error'], 'already_subscribed')


class SubscriptionManagerEdgeCaseTestCase(BaseTestCase):
    """SubscriptionManagerのエッジケーステスト"""

    def setUp(self):
        """テスト用ユーザーの作成"""
        super().setUp()
        self.user = create_test_user()

    def test_handle_invoice_paid_without_subscription(self):
        """サブスクリプション情報がないinvoice.paidイベントの処理テスト"""
        self.user.stripe_customer_id = 'cus_test123'
        self.user.save()

        event_data = {
            "type": "invoice.paid",
            "data": {
                "object": {
                    "customer": self.user.stripe_customer_id,
                    # subscriptionフィールドがない
                }
            }
        }

        with patch("Co_fitting.services.email_service.send_mail") as mock_send_mail:
            response = self.client.post(
                reverse('purchase:webhook'),
                data=json.dumps(event_data),
                content_type='application/json'
            )

        # エラーにならず、メールが送信されることを確認
        self.assertEqual(response.status_code, 200)
        mock_send_mail.assert_called_once()

    @patch('stripe.Subscription.retrieve')
    def test_handle_invoice_paid_with_metadata_plan_type(self, mock_retrieve):
        """メタデータからプランタイプを取得するinvoice.paidイベントの処理テスト"""
        self.user.stripe_customer_id = 'cus_test123'
        self.user.save()

        mock_subscription = {
            "id": "sub_test123",
            "metadata": {"plan_type": AppConstants.PLAN_PREMIUM},
            "items": {
                "data": [{
                    "price": {"id": "price_test"}
                }]
            }
        }
        mock_retrieve.return_value = mock_subscription

        event_data = {
            "type": "invoice.paid",
            "data": {
                "object": {
                    "customer": self.user.stripe_customer_id,
                    "subscription": "sub_test123"
                }
            }
        }

        with patch("Co_fitting.services.email_service.send_mail"):
            response = self.client.post(
                reverse('purchase:webhook'),
                data=json.dumps(event_data),
                content_type='application/json'
            )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.plan_type, AppConstants.PLAN_PREMIUM)

    def test_handle_subscription_change_with_unknown_status(self):
        """不明なステータスのサブスクリプション変更イベントの処理テスト"""
        self.user.stripe_customer_id = 'cus_test123'
        self.user.plan_type = AppConstants.PLAN_BASIC
        self.user.save()

        event_data = {
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "customer": self.user.stripe_customer_id,
                    "status": "unknown_status",
                    "metadata": {"plan_type": AppConstants.PLAN_BASIC},
                    "items": {
                        "data": [{
                            "price": {"id": "price_test"}
                        }]
                    }
                }
            }
        }

        response = self.client.post(
            reverse('purchase:webhook'),
            data=json.dumps(event_data),
            content_type='application/json'
        )

        # エラーにならず、プランが変更されないことを確認
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.plan_type, AppConstants.PLAN_BASIC)
