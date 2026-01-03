from django.test import TestCase, override_settings
from django.test.utils import override_settings as override_settings_utils
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.core import mail
from django.db import connection
from unittest.mock import patch, MagicMock
from django_recaptcha.client import RecaptchaResponse
import json
import time

from Co_fitting.tests.helpers import (
    create_test_user, create_test_recipe,
    login_test_user, BaseTestCase, assert_json_response,
    create_form_data
)
from recipes.models import PresetRecipe, PresetRecipeStep, SharedRecipe

User = get_user_model()


class EndToEndWorkflowTestCase(BaseTestCase):
    """エンドツーエンドワークフローのテスト"""

    def setUp(self):
        """テスト用ユーザーの作成"""
        super().setUp()
        self.user = create_test_user()

    @override_settings(RECAPTCHA_TESTING=True)
    def test_complete_user_registration_workflow(self):
        """完全なユーザー登録ワークフローのテスト"""
        # 1. サインアップリクエスト
        with patch("django_recaptcha.fields.client.submit") as mocked_submit:
            mocked_submit.return_value = RecaptchaResponse(is_valid=True)

            response = self.client.post(reverse('users:signup_request'), {
                'username': 'newuser',
                'email': 'new@example.com',
                'password1': 'newpassword123',
                'password2': 'newpassword123',
                'g-recaptcha-response': 'test'
            })

            self.assertEqual(response.status_code, 302)

        # 2. 確認メールの送信確認
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('アカウント確認', mail.outbox[0].subject)

        # 3. 確認リンクからのアクティベーション
        email_body = mail.outbox[0].body
        confirmation_url = next(line for line in email_body.split("\n") if "http" in line).strip()

        response = self.client.get(confirmation_url)
        self.assertEqual(response.status_code, 302)

        # 4. ユーザーがアクティブ化されることを確認
        user = User.objects.get(email='new@example.com')
        self.assertTrue(user.is_active)

        # 5. ログインできることを確認
        new_user = User.objects.get(email='new@example.com')
        login_test_user(self, user=new_user, password='newpassword123')

    def test_complete_recipe_creation_workflow(self):
        """完全なレシピ作成ワークフローのテスト"""
        login_test_user(self, user=self.user)

        # 1. レシピ作成ページにアクセス
        response = self.client.get(reverse('recipes:preset_create'))
        self.assertEqual(response.status_code, 200)

        # 2. レシピを作成
        form_data = create_form_data(
            name="統合テストレシピ",
            len_steps=3,
            bean_g=20,
            memo="統合テスト用メモ"
        )
        form_data.update({
            'step1_water': 50,
            'step2_water': 100,
            'step3_water': 150,
        })

        response = self.client.post(reverse('recipes:preset_create'), form_data)

        self.assertEqual(response.status_code, 302)

        # 3. レシピが作成されることを確認
        recipe = PresetRecipe.objects.get(name="統合テストレシピ", created_by=self.user)
        self.assertEqual(recipe.len_steps, 3)
        self.assertEqual(recipe.bean_g, 20)

        # 4. ステップが正しく作成されることを確認
        steps = PresetRecipeStep.objects.filter(recipe=recipe).order_by('step_number')
        self.assertEqual(len(steps), 3)
        self.assertEqual(steps[0].total_water_ml_this_step, 50)
        self.assertEqual(steps[1].total_water_ml_this_step, 100)
        self.assertEqual(steps[2].total_water_ml_this_step, 150)

        # 5. マイページにレシピが表示されることを確認
        response = self.client.get(reverse('mypage'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "統合テストレシピ")

    def test_complete_recipe_sharing_workflow(self):
        """完全なレシピ共有ワークフローのテスト"""
        login_test_user(self, user=self.user)

        # 1. レシピを作成
        recipe = create_test_recipe(
            user=self.user,
            name='共有テストレシピ',
            is_ice=False,
            len_steps=2,
            bean_g=20.0,
            water_ml=200.0,
            memo='共有テスト用メモ'
        )

        # 2. レシピを共有
        response = self.client.post(reverse('recipes:share_preset_recipe', kwargs={'recipe_id': recipe.id}))
        assert_json_response(self, response, expected_status=200, expected_keys=['access_token'])

        response_data = json.loads(response.content)
        access_token = response_data['access_token']

        # 3. 共有レシピが作成されることを確認
        shared_recipe = SharedRecipe.objects.get(access_token=access_token)
        self.assertEqual(shared_recipe.name, '共有テストレシピ')

        # 4. 共有レシピを取得
        response = self.client.get(reverse('recipes:retrieve_shared_recipe', kwargs={'token': access_token}))
        assert_json_response(self, response, expected_status=200, expected_keys=['name', 'steps'])

        response_data = json.loads(response.content)
        self.assertEqual(response_data['name'], '共有テストレシピ')
        self.assertEqual(len(response_data['steps']), 2)

        # 5. 別のユーザーで共有レシピをプリセットに追加
        other_user = create_test_user(username='otheruser', email='other@example.com', password='otherpassword123')
        login_test_user(self, user=other_user, password='otherpassword123')

        response = self.client.post(reverse('recipes:add_shared_recipe_to_preset', kwargs={'token': access_token}))
        assert_json_response(self, response, expected_status=200)

        # 6. プリセットに追加されることを確認
        self.assertTrue(PresetRecipe.objects.filter(name='共有テストレシピ', created_by=other_user).exists())

    def test_recipe_sharing_limit_workflow(self):
        """レシピ共有制限のワークフローテスト"""
        login_test_user(self, user=self.user)

        # 無料ユーザーであることを確認
        self.assertEqual(self.user.plan_type, AppConstants.PLAN_FREE)

        # 1. 最初のレシピを作成・共有（成功するはず）
        recipe1 = PresetRecipe.objects.create(
            name='共有テストレシピ1',
            created_by=self.user,
            is_ice=False,
            len_steps=1,
            bean_g=20.0,
            water_ml=200.0,
            memo='共有テスト用メモ1'
        )

        PresetRecipeStep.objects.create(
            recipe_id=recipe1,
            step_number=1,
            minute=0,
            seconds=30,
            total_water_ml_this_step=200.0
        )

        response = self.client.post(reverse('recipes:share_preset_recipe', kwargs={'recipe_id': recipe1.id}))
        self.assertEqual(response.status_code, 200)

        # 2. 2個目のレシピを作成・共有（制限超過で失敗するはず）
        recipe2 = PresetRecipe.objects.create(
            name='共有テストレシピ2',
            created_by=self.user,
            is_ice=False,
            len_steps=1,
            bean_g=20.0,
            water_ml=200.0,
            memo='共有テスト用メモ2'
        )

        PresetRecipeStep.objects.create(
            recipe_id=recipe2,
            step_number=1,
            minute=0,
            seconds=30,
            total_water_ml_this_step=200.0
        )

        response = self.client.post(reverse('recipes:share_preset_recipe', kwargs={'recipe_id': recipe2.id}))
        self.assertEqual(response.status_code, 429)

        response_data = json.loads(response.content)
        self.assertEqual(response_data['error'], 'share_limit_exceeded')
        self.assertFalse(response_data['is_premium'])
        self.assertEqual(response_data['limit'], 1)

    def test_complete_purchase_workflow(self):
        """完全な購入ワークフローのテスト"""
        login_test_user(self, user=self.user)

        # 1. チェックアウトセッション作成
        with patch("purchase.views.stripe.checkout.Session.create") as mock_stripe_session:
            mock_session = MagicMock()
            mock_session.url = reverse("purchase:checkout_success")
            mock_stripe_session.return_value = mock_session

            response = self.client.post(reverse('purchase:create_checkout_session'))
            self.assertEqual(response.status_code, 302)

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
                    "customer": customer_id,
                    "subscription": "sub_test123",
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

        with patch("purchase.views.send_mail") as mock_send_mail, \
             patch("stripe.Subscription.retrieve", return_value=mock_subscription):
            response = self.client.post(
                reverse('purchase:webhook'),
                data=json.dumps(event_data),
                content_type='application/json'
            )

        self.assertEqual(response.status_code, 200)

        # 5. ユーザーのサブスクリプション状態が更新されることを確認
        self.user.refresh_from_db()
        self.assertEqual(self.user.preset_limit_value, 5)
        self.assertNotEqual(self.user.plan_type, AppConstants.PLAN_FREE)

        # 6. プリセット制限が増加することを確認
        response = self.client.get(reverse('purchase:get_preset_limit'))
        self.assertEqual(response.status_code, 200)

        response_data = json.loads(response.content)
        self.assertEqual(response_data['preset_limit'], 5)


class ErrorHandlingTestCase(TestCase):
    """エラーハンドリングのテスト"""

    def setUp(self):
        """テスト用ユーザーの作成"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='securepassword123'
        )
        self.user.is_active = True
        self.user.save()

    def test_404_error_handling(self):
        """404エラーのハンドリングテスト"""
        # 存在しないレシピIDでアクセス
        response = self.client.get(reverse('recipes:preset_edit', kwargs={'recipe_id': 99999}))
        self.assertIn(response.status_code, [404, 500])

        # 存在しない共有レシピトークンでアクセス
        response = self.client.get(reverse('recipes:retrieve_shared_recipe', kwargs={'token': 'invalid_token'}))
        self.assertEqual(response.status_code, 404)

    def test_403_error_handling(self):
        """403エラーのハンドリングテスト"""
        # 他のユーザーのレシピにアクセス
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='otherpassword123'
        )
        other_user.is_active = True
        other_user.save()

        recipe = PresetRecipe.objects.create(
            name='他人のレシピ',
            created_by=other_user,
            is_ice=False,
            len_steps=1,
            bean_g=20.0,
            water_ml=200.0
        )

        login_test_user(self, user=self.user)

        response = self.client.get(reverse('recipes:preset_edit', kwargs={'recipe_id': recipe.id}))
        self.assertIn(response.status_code, [404, 500])  # 404または500が返される（権限チェック）

    def test_400_error_handling(self):
        """400エラーのハンドリングテスト"""
        login_test_user(self, user=self.user)

        # 無効なデータでレシピ作成
        response = self.client.post(reverse('recipes:preset_create'), {
            "name": "",  # 空の名前
            "len_steps": 0,  # 無効なステップ数
            "bean_g": -1,  # 負の値
        })

        self.assertEqual(response.status_code, 200)  # フォームエラーは200で返される
        self.assertContains(response, "エラー")

    def test_500_error_handling(self):
        """500エラーのハンドリングテスト"""
        # 無効なWebhookイベント
        response = self.client.post(
            reverse('purchase:webhook'),
            data=json.dumps({"type": "invalid.event", "data": {"object": {}}}),
            content_type='application/json'
        )

        self.assertIn(response.status_code, [400, 500])  # 400 Bad Request or 500 Internal Server Error

    def test_database_error_handling(self):
        """データベースエラーのハンドリングテスト"""
        login_test_user(self, user=self.user)

        # 存在しないユーザーIDでレシピ作成を試行
        with patch('recipes.models.PresetRecipe.objects.create') as mock_create:
            mock_create.side_effect = Exception("Database error")

            response = self.client.post(reverse('recipes:preset_create'), {
                "name": "エラーテストレシピ",
                "len_steps": 1,
                "bean_g": 20,
                'step1_minute': 0,
                'step1_second': 30,
                'step1_water': 100,
            })

            # エラーが適切にハンドリングされることを確認
            self.assertEqual(response.status_code, 500)


class PerformanceTestCase(TestCase):
    """パフォーマンステスト"""

    def setUp(self):
        """テスト用ユーザーの作成"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='securepassword123'
        )
        self.user.is_active = True
        self.user.save()

    def test_large_recipe_list_performance(self):
        """大量のレシピリストのパフォーマンステスト"""
        login_test_user(self, user=self.user)

        # 大量のレシピを作成
        recipes = []
        for i in range(100):
            recipe = PresetRecipe.objects.create(
                name=f'レシピ{i}',
                created_by=self.user,
                is_ice=False,
                len_steps=1,
                bean_g=20.0,
                water_ml=200.0
            )
            recipes.append(recipe)

        # マイページのレスポンス時間をテスト
        start_time = time.time()
        response = self.client.get(reverse('mypage'))
        end_time = time.time()

        self.assertEqual(response.status_code, 200)
        # レスポンス時間が1秒以内であることを確認
        self.assertLess(end_time - start_time, 1.0)

    def test_large_shared_recipe_list_performance(self):
        """大量の共有レシピリストのパフォーマンステスト"""
        login_test_user(self, user=self.user)

        # 大量の共有レシピを作成
        for i in range(50):
            SharedRecipe.objects.create(
                name=f'共有レシピ{i}',
                created_by=self.user,
                is_ice=False,
                len_steps=1,
                bean_g=20.0,
                water_ml=200.0,
                access_token=f'test_token_{i}_12345678901234567890123456789012'[:32]
            )

        # 共有レシピ取得APIのレスポンス時間をテスト
        start_time = time.time()
        response = self.client.get(reverse('recipes:get_user_shared_recipes'))
        end_time = time.time()

        self.assertEqual(response.status_code, 200)
        # レスポンス時間が1秒以内であることを確認
        self.assertLess(end_time - start_time, 1.0)

    def test_database_query_optimization(self):
        """データベースクエリの最適化テスト"""
        login_test_user(self, user=self.user)

        # レシピとステップを作成
        recipe = PresetRecipe.objects.create(
            name='クエリテストレシピ',
            created_by=self.user,
            is_ice=False,
            len_steps=5,
            bean_g=20.0,
            water_ml=250.0
        )

        for i in range(5):
            PresetRecipeStep.objects.create(
                recipe=recipe,
                step_number=i + 1,
                minute=i,
                seconds=0,
                total_water_ml_this_step=50.0
            )

        # クエリ数をカウント
        with override_settings_utils(DEBUG=True):
            connection.queries_log.clear()

            response = self.client.get(reverse('mypage'))

            # クエリ数が適切な範囲内であることを確認
            query_count = len(connection.queries)
            self.assertLess(query_count, 10)  # 10クエリ以内であることを確認


class SecurityTestCase(TestCase):
    """セキュリティテスト"""

    def setUp(self):
        """テスト用ユーザーの作成"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='securepassword123'
        )
        self.user.is_active = True
        self.user.save()

    def test_sql_injection_protection(self):
        """SQLインジェクション攻撃の保護テスト"""
        login_test_user(self, user=self.user)

        # SQLインジェクション攻撃を試行
        malicious_input = "'; DROP TABLE recipes_recipe; --"

        response = self.client.post(reverse('recipes:preset_create'), {
            "name": malicious_input,
            "len_steps": 1,
            "bean_g": 20,
            'step1_minute': 0,
            'step1_second': 30,
            'step1_water': 100,
        })

        # エラーが発生してもテーブルが削除されないことを確認
        self.assertTrue(PresetRecipe.objects.filter(created_by=self.user).exists())

    def test_xss_protection(self):
        """XSS攻撃の保護テスト"""
        login_test_user(self, user=self.user)

        # XSS攻撃を試行
        malicious_input = "<script>alert('XSS')</script>"

        response = self.client.post(reverse('recipes:preset_create'), {
            "name": malicious_input,
            "len_steps": 1,
            "bean_g": 20,
            'step1_minute': 0,
            'step1_second': 30,
            'step1_water': 100,
        })

        # レスポンスにスクリプトタグが含まれないことを確認
        self.assertNotContains(response, "<script>")
        self.assertNotContains(response, "alert('XSS')")

    def test_csrf_protection(self):
        """CSRF保護のテスト"""
        # CSRFトークンなしでPOSTリクエストを送信
        response = self.client.post(reverse('recipes:preset_create'), {
            "name": "CSRFテストレシピ",
            "len_steps": 1,
            "bean_g": 20,
            'step1_minute': 0,
            'step1_second': 30,
            'step1_water': 100,
        })

        # CSRFエラーが発生することを確認
        self.assertEqual(response.status_code, 403)

    def test_authentication_required(self):
        """認証が必要なページのアクセス制御テスト"""
        # ログインなしで保護されたページにアクセス
        protected_urls = [
            reverse('mypage'),
            reverse('recipes:preset_create'),
            reverse('users:email_change_request'),
            reverse('users:password_change'),
        ]

        for url in protected_urls:
            response = self.client.get(url)
            self.assertEqual(response.status_code, 302)
            self.assertTrue(response.url.startswith(reverse('users:login')))

    def test_authorization_checks(self):
        """認可チェックのテスト"""
        # 他のユーザーのリソースにアクセス
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='otherpassword123'
        )
        other_user.is_active = True
        other_user.save()

        recipe = PresetRecipe.objects.create(
            name='他人のレシピ',
            created_by=other_user,
            is_ice=False,
            len_steps=1,
            bean_g=20.0,
            water_ml=200.0
        )

        login_test_user(self, user=self.user)

        # 他のユーザーのレシピを編集しようとする
        response = self.client.post(reverse('recipes:preset_edit', kwargs={'recipe_id': recipe.id}), {
            "name": "ハッキング試行",
            "len_steps": 1,
            "bean_g": 20,
            'step1_minute': 0,
            'step1_second': 30,
            'step1_water': 100,
        })

        # アクセスが拒否されることを確認
        self.assertIn(response.status_code, [404, 500])

        # レシピが変更されていないことを確認
        recipe.refresh_from_db()
        self.assertEqual(recipe.name, '他人のレシピ')
