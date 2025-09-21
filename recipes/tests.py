from django.test import TestCase
from django.urls import reverse
from users.models import User
from recipes.models import Recipe, RecipeStep, SharedRecipe, SharedRecipeStep
from django.utils import timezone
from datetime import timedelta
import json
import os
from django.conf import settings
from django.core.management import call_command


def create_mock_recipe(user, name, is_ice, len_steps, bean_g, water_ml, memo):
    recipe = Recipe.objects.create(
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
            recipe_id=recipe,
            step_number=i + 1,
            minute=i,
            seconds=0,
            total_water_ml_this_step=water_ml / len_steps,
        )
    return recipe


def create_mock_shared_recipe(user, name, is_ice, len_steps, bean_g, water_ml, memo):
    # ユニークなアクセストークンを生成（他のテストと同様の形式）
    import uuid
    unique_id = str(uuid.uuid4()).replace('-', '')[:8]
    access_token = f'test_token_{unique_id}_12345678901234567890123456789012'[:32]
    
    shared_recipe = SharedRecipe.objects.create(
        name=name,
        shared_by_user=user,
        is_ice=is_ice,
        len_steps=len_steps,
        bean_g=bean_g,
        water_ml=water_ml,
        memo=memo,
        expires_at=timezone.now() + timedelta(days=7),
        access_token=access_token
    )
    for i in range(len_steps):
        SharedRecipeStep.objects.create(
            shared_recipe=shared_recipe,
            step_number=i + 1,
            minute=i,
            seconds=0,
            total_water_ml_this_step=water_ml / len_steps,
        )
    return shared_recipe


class RecipeCreateTestCase(TestCase):
    def setUp(self):
        """テストユーザーの作成とログイン"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='securepassword123'
        )
        self.user.is_active = True
        self.user.save()

        login_success = self.client.login(username='test@example.com', password='securepassword123')
        self.assertTrue(login_success)
        self.create_url = reverse('recipes:preset_create')  # レシピ作成URL

    def test_create_recipe_success(self):
        """プリセットレシピ作成が正常にできるか"""
        response = self.client.post(self.create_url, {
            "name": "テストレシピ",
            "len_steps": 2,
            "bean_g": 20,
            'step1_minute': 0,
            'step1_second': 00,
            'step1_water': 30,
            'step2_minute': 1,
            'step2_second': 00,
            'step2_water': 120,
            "memo": "テスト用メモ",
        })

        self.assertEqual(response.status_code, 302)  # リダイレクト確認
        self.assertTrue(Recipe.objects.filter(name="テストレシピ", create_user=self.user).exists())  # DBに作成されたか確認

    def test_create_ice_recipe_success(self):
        """アイス用プリセットレシピ作成が正常にできるか"""
        response = self.client.post(self.create_url, {
            "name": "テストレシピ アイス",
            "is_ice": True,
            "ice_g": 80,
            "len_steps": 2,
            "bean_g": 20,
            'step1_minute': 0,
            'step1_second': 00,
            'step1_water': 30,
            'step2_minute': 1,
            'step2_second': 00,
            'step2_water': 120,
            "memo": "アイステスト用メモ",
        })

        self.assertEqual(response.status_code, 302)  # リダイレクト確認
        self.assertTrue(Recipe.objects.filter(name="テストレシピ アイス", create_user=self.user).exists())  # DBに作成されたか確認

    def test_create_recipe_limit_exceeded(self):
        """プリセットレシピ作成時の上限チェック"""
        # 既に上限いっぱいまでレシピを作成済
        Recipe.objects.bulk_create([
            Recipe(name=f"レシピ{i+1}", create_user=self.user, is_ice=False, len_steps=3, bean_g=15.0, water_ml=250.0)
            for i in range(self.user.preset_limit)
        ])

        response = self.client.post(self.create_url, {
            "name": "上限超えレシピ",
            "len_steps": 2,
            "bean_g": 20,
            'step1_minute': 0,
            'step1_second': 00,
            'step1_water': 30,
            'step2_minute': 1,
            'step2_second': 00,
            'step2_water': 120,
            "memo": "上限超えレシピテスト用メモ",
        })

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "エラー：プリセットレシピ上限を超過しています")  # エラーメッセージが表示されるか確認
        self.assertFalse(Recipe.objects.filter(name="上限超えレシピ", create_user=self.user).exists())  # DBに登録されていないことを確認


class RecipeEditTestCase(TestCase):
    def setUp(self):
        """テストユーザーの作成とログイン"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='securepassword123'
        )
        self.user.is_active = True
        self.user.save()

        login_success = self.client.login(username='test@example.com', password='securepassword123')
        self.assertTrue(login_success)

        # テスト用のレシピを作成
        self.recipe = create_mock_recipe(
            user=self.user,
            name="テストレシピ",
            is_ice=False,
            len_steps=2,
            bean_g=20,
            water_ml=200,
            memo="テスト用メモ"
        )
        self.edit_url = reverse('recipes:preset_edit', kwargs={'recipe_id': self.recipe.id})  # レシピ編集URL

    def test_edit_recipe_success(self):
        """プリセットレシピ編集が正常にできるか"""
        response = self.client.post(self.edit_url, {
            "name": "編集後レシピ",
            "len_steps": 3,
            "bean_g": 25,
            'step1_minute': 0,
            'step1_second': 30,
            'step1_water': 40,
            'step2_minute': 1,
            'step2_second': 30,
            'step2_water': 100,
            'step3_minute': 2,
            'step3_second': 00,
            'step3_water': 150,
            "memo": "編集後のメモ",
        })

        self.assertEqual(response.status_code, 302)  # 成功時はリダイレクト
        self.recipe.refresh_from_db()  # DBの変更を反映
        self.assertEqual(self.recipe.name, "編集後レシピ")  # 名前が変更されているか
        self.assertEqual(self.recipe.len_steps, 3)  # ステップ数が変更されているか
        self.assertEqual(self.recipe.bean_g, 25)  # 豆の量が変更されているか
        self.assertEqual(self.recipe.memo, "編集後のメモ")  # メモが変更されているか

    def test_edit_recipe_404_for_other_user(self):
        """他のユーザーが編集を試みた場合、404 Page not found になるか"""
        self.otheruser = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='otherpassword123'
        )
        self.otheruser.is_active = True
        self.otheruser.save()
        login_success = self.client.login(username='other@example.com', password='otherpassword123')
        self.assertTrue(login_success)

        response = self.client.post(self.edit_url, {
            "name": "他人による編集",
            "len_steps": 1,
            "bean_g": 15,
            'step1_minute': 0,
            'step1_second': 0,
            'step1_water': 30,
            "memo": "他人が編集しようとしたメモ",
        })
        self.assertEqual(response.status_code, 404)  # 404が返ってくることを確認
        self.recipe.refresh_from_db()
        self.assertNotEqual(self.recipe.name, "他人による編集")  # 名前が変更されていないことを確認

    def test_edit_recipe_redirects_for_anonymous_user(self):
        """未ログインユーザーが編集を試みた場合、ログインページにリダイレクトされるか"""
        self.client.logout()

        response = self.client.post(self.edit_url, {
            "name": "未ログインユーザーの編集",
            "len_steps": 1,
            "bean_g": 15,
            'step1_minute': 0,
            'step1_second': 00,
            'step1_water': 30,
            "memo": "未ログインで編集",
        })

        self.assertEqual(response.status_code, 302)  # リダイレクトされることを確認
        self.assertTrue(response.url.startswith(reverse('users:login')))  # ログインページへリダイレクトされることを確認


class RecipeDeleteTestCase(TestCase):
    def setUp(self):
        """テスト用ユーザーとレシピの作成"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='securepassword123'
        )
        self.user.is_active = True
        self.user.save()

        self.other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='securepassword456'
        )
        self.other_user.is_active = True
        self.other_user.save()

        self.recipe = create_mock_recipe(
            user=self.user,
            name="削除対象レシピ",
            is_ice=False,
            len_steps=2,
            bean_g=20,
            water_ml=200,
            memo="削除用メモ"
        )
        self.delete_url = reverse('recipes:preset_delete', kwargs={'pk': self.recipe.id})  # 削除URL

    def test_delete_recipe_success(self):
        """プリセットレシピ削除が正常にできるか"""
        self.client.login(username='test@example.com', password='securepassword123')
        response = self.client.post(self.delete_url)

        self.assertEqual(response.status_code, 302)  # リダイレクト確認
        self.assertFalse(Recipe.objects.filter(id=self.recipe.id).exists())  # DBから削除されたことを確認

    def test_delete_recipe_not_owner(self):
        """他のユーザーのプリセットレシピ削除ができないことを確認"""
        self.client.login(username='other@example.com', password='securepassword456')
        response = self.client.post(self.delete_url)

        self.assertEqual(response.status_code, 404)  # 権限なしなら404が返る
        self.assertTrue(Recipe.objects.filter(id=self.recipe.id).exists())  # レシピが削除されていないことを確認

    def test_delete_recipe_not_logged_in(self):
        """ログインしていない状態でレシピを削除できないことを確認"""
        response = self.client.post(self.delete_url)

        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith(reverse('users:login')))  # ログイン画面にリダイレクトされることを確認
        self.assertTrue(Recipe.objects.filter(id=self.recipe.id).exists())  # レシピが削除されていないことを確認


class RecipeActivationTestCase(TestCase):
    def setUp(self):
        """テスト用ユーザーとレシピの作成"""
        self.default_preset_user = User.objects.create_user(
            username='DefaultPreset',
            email='default@example.com',
            password='defaultpassword123'
        )
        self.default_preset_user.is_active = True
        self.default_preset_user.save()
        self.default_preset_recipe = create_mock_recipe(
            user=self.default_preset_user,
            name="デフォルトプリセットレシピ",
            is_ice=False,
            len_steps=1,
            bean_g=20,
            water_ml=200,
            memo="デフォルトプリセットメモ"
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

        self.recipe = create_mock_recipe(
            user=self.user,
            name="ユーザープリセットレシピ",
            is_ice=False,
            len_steps=2,
            bean_g=20,
            water_ml=200,
            memo="ユーザープリセットメモ"
        )
        self.index_url = reverse('recipes:index')  # 呼び出しを行うページのURL

    def test_preset_recipes_displayed_on_conversion_page(self):
        """変換ページにプリセットレシピが表示されていることを確認"""
        response = self.client.get(self.index_url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "デフォルトプリセットレシピ")
        self.assertContains(response, "ユーザープリセットレシピ")


class SharedRecipeTestCase(TestCase):
    def setUp(self):
        """テストユーザーの作成とログイン"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='securepassword123'
        )
        self.user.is_active = True
        self.user.save()

        login_success = self.client.login(username='test@example.com', password='securepassword123')
        self.assertTrue(login_success)
        
        self.create_url = reverse('recipes:create_shared_recipe')

    def test_create_shared_recipe_success(self):
        """共有レシピ作成が正常にできるか"""
        recipe_data = {
            "name": "テスト共有レシピ",
            "bean_g": 20.0,
            "water_ml": 200.0,
            "is_ice": False,
            "len_steps": 2,
            "steps": [
                {
                    "step_number": 1,
                    "minute": 0,
                    "seconds": 0,
                    "total_water_ml_this_step": 100.0
                },
                {
                    "step_number": 2,
                    "minute": 1,
                    "seconds": 0,
                    "total_water_ml_this_step": 100.0
                }
            ]
        }

        response = self.client.post(
            self.create_url,
            data=json.dumps(recipe_data),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        self.assertIn('access_token', response_data)
        self.assertIn('url', response_data)
        self.assertTrue(SharedRecipe.objects.filter(name="テスト共有レシピ", shared_by_user=self.user).exists())

    def test_create_shared_recipe_missing_required_fields(self):
        """必須項目が欠落している場合のエラーハンドリング"""
        recipe_data = {
            "name": "テスト共有レシピ",
            # bean_gが欠落
            "water_ml": 200.0,
            "is_ice": False,
            "len_steps": 2,
            "steps": []
        }

        response = self.client.post(
            self.create_url,
            data=json.dumps(recipe_data),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['error'], 'invalid_data')

    def test_create_shared_recipe_invalid_steps(self):
        """ステップ数が不正な場合のエラーハンドリング"""
        recipe_data = {
            "name": "テスト共有レシピ",
            "bean_g": 20.0,
            "water_ml": 200.0,
            "is_ice": False,
            "len_steps": 3,  # ステップ数と実際のステップ数が不一致
            "steps": [
                {
                    "step_number": 1,
                    "minute": 0,
                    "seconds": 0,
                    "total_water_ml_this_step": 100.0
                }
            ]
        }

        response = self.client.post(
            self.create_url,
            data=json.dumps(recipe_data),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['error'], 'invalid_data')

    def test_create_shared_recipe_rate_limit_exceeded(self):
        """レートリミット超過時のエラーハンドリング"""
        # 1週間以内に10個の共有レシピを作成
        for i in range(10):
            # 各レシピで異なるaccess_tokenを使用
            shared_recipe = SharedRecipe.objects.create(
                name=f"レートリミットテスト{i+1}",
                shared_by_user=self.user,
                is_ice=False,
                len_steps=1,
                bean_g=20.0,
                water_ml=200.0,
                memo="レートリミットテスト",
                expires_at=timezone.now() + timedelta(days=7),
                access_token=f'test_token_{i:02d}_12345678901234567890123456789012'[:32]
            )
            SharedRecipeStep.objects.create(
                shared_recipe=shared_recipe,
                step_number=1,
                minute=0,
                seconds=0,
                total_water_ml_this_step=200.0,
            )

        recipe_data = {
            "name": "11個目の共有レシピ",
            "bean_g": 20.0,
            "water_ml": 200.0,
            "is_ice": False,
            "len_steps": 1,
            "steps": [
                {
                    "step_number": 1,
                    "minute": 0,
                    "seconds": 0,
                    "total_water_ml_this_step": 200.0
                }
            ]
        }

        response = self.client.post(
            self.create_url,
            data=json.dumps(recipe_data),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 429)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['error'], 'share_limit_exceeded')

    def test_create_shared_recipe_not_logged_in(self):
        """未ログインユーザーが共有レシピ作成を試みた場合のエラーハンドリング"""
        self.client.logout()

        recipe_data = {
            "name": "未ログインテスト",
            "bean_g": 20.0,
            "water_ml": 200.0,
            "is_ice": False,
            "len_steps": 1,
            "steps": [
                {
                    "step_number": 1,
                    "minute": 0,
                    "seconds": 0,
                    "total_water_ml_this_step": 200.0
                }
            ]
        }

        response = self.client.post(
            self.create_url,
            data=json.dumps(recipe_data),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 302)  # ログインページにリダイレクト（@login_requiredデコレータの動作）

    def test_shared_recipe_step_cumulative_water(self):
        """共有レシピDBの各ステップに累積湯量が正しく格納されるか"""
        recipe_data = {
            "name": "累積湯量テスト",
            "bean_g": 16.0,
            "water_ml": 120.0,
            "is_ice": False,
            "len_steps": 5,
            "steps": [
                {"step_number": 1, "minute": 0, "seconds": 0, "total_water_ml_this_step": 24.0},
                {"step_number": 2, "minute": 0, "seconds": 40, "total_water_ml_this_step": 24.0},
                {"step_number": 3, "minute": 1, "seconds": 10, "total_water_ml_this_step": 24.0},
                {"step_number": 4, "minute": 1, "seconds": 40, "total_water_ml_this_step": 24.0},
                {"step_number": 5, "minute": 2, "seconds": 10, "total_water_ml_this_step": 24.0},
            ]
        }
        response = self.client.post(
            self.create_url,
            data=json.dumps(recipe_data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        # 作成された共有レシピを取得
        shared_recipe = SharedRecipe.objects.get(name="累積湯量テスト")
        steps = SharedRecipeStep.objects.filter(shared_recipe=shared_recipe).order_by('step_number')
        cumulative_expected = [24.0, 48.0, 72.0, 96.0, 120.0]
        for step, expected in zip(steps, cumulative_expected):
            self.assertEqual(step.total_water_ml_this_step, expected)


class SharedRecipeRetrieveTestCase(TestCase):
    def setUp(self):
        """テストユーザーと共有レシピの作成"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='securepassword123'
        )
        self.user.is_active = True
        self.user.save()

        self.shared_recipe = create_mock_shared_recipe(
            user=self.user,
            name="テスト共有レシピ",
            is_ice=False,
            len_steps=2,
            bean_g=20.0,
            water_ml=200.0,
            memo="テスト用メモ"
        )

    def test_retrieve_shared_recipe_success(self):
        """有効なトークンで共有レシピが取得できるか"""
        retrieve_url = reverse('recipes:retrieve_shared_recipe', kwargs={'token': self.shared_recipe.access_token})
        response = self.client.get(retrieve_url)

        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['name'], "テスト共有レシピ")
        self.assertEqual(response_data['bean_g'], 20.0)
        self.assertEqual(response_data['water_ml'], 200.0)
        self.assertEqual(len(response_data['steps']), 2)

    def test_retrieve_shared_recipe_not_found(self):
        """存在しないトークンでのエラーハンドリング"""
        retrieve_url = reverse('recipes:retrieve_shared_recipe', kwargs={'token': 'invalid_token'})
        response = self.client.get(retrieve_url)

        self.assertEqual(response.status_code, 404)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['error'], 'not_found')

    def test_retrieve_shared_recipe_expired(self):
        """期限切れトークンでのエラーハンドリング"""
        # 期限切れの共有レシピを作成
        expired_recipe = SharedRecipe.objects.create(
            name="期限切れレシピ",
            shared_by_user=self.user,
            is_ice=False,
            len_steps=1,
            bean_g=20.0,
            water_ml=200.0,
            memo="期限切れテスト",
            expires_at=timezone.now() - timedelta(days=1),  # 1日前に期限切れ
            access_token='expired_token_12345678901234567890123456789012'[:32]
        )

        retrieve_url = reverse('recipes:retrieve_shared_recipe', kwargs={'token': expired_recipe.access_token})
        response = self.client.get(retrieve_url)

        self.assertEqual(response.status_code, 410)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['error'], 'expired')


class SharedRecipeAddToPresetTestCase(TestCase):
    def setUp(self):
        """テストユーザーと共有レシピの作成"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='securepassword123'
        )
        self.user.is_active = True
        self.user.save()

        login_success = self.client.login(username='test@example.com', password='securepassword123')
        self.assertTrue(login_success)

        self.shared_recipe = create_mock_shared_recipe(
            user=self.user,
            name="テスト共有レシピ",
            is_ice=False,
            len_steps=2,
            bean_g=20.0,
            water_ml=200.0,
            memo="テスト用メモ"
        )

    def test_add_shared_recipe_to_preset_success(self):
        """プリセットに共有レシピが正常に追加できるか"""
        add_url = reverse('recipes:add_shared_recipe_to_preset', kwargs={'token': self.shared_recipe.access_token})
        response = self.client.post(add_url)

        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        self.assertTrue(response_data['success'])
        self.assertIn('recipe_id', response_data)
        
        # プリセットに追加されたことを確認
        self.assertTrue(Recipe.objects.filter(name="テスト共有レシピ", create_user=self.user).exists())
        added_recipe = Recipe.objects.get(name="テスト共有レシピ", create_user=self.user)
        self.assertEqual(added_recipe.bean_g, 20.0)
        self.assertEqual(added_recipe.water_ml, 200.0)
        self.assertEqual(added_recipe.len_steps, 2)

    def test_add_shared_recipe_to_preset_limit_exceeded_free_user(self):
        """無料ユーザーのプリセット枠上限時のエラーハンドリング"""
        # プリセット枠を上限まで埋める
        for i in range(self.user.preset_limit):
            create_mock_recipe(
                user=self.user,
                name=f"プリセット{i+1}",
                is_ice=False,
                len_steps=1,
                bean_g=20.0,
                water_ml=200.0,
                memo="プリセット上限テスト"
            )

        add_url = reverse('recipes:add_shared_recipe_to_preset', kwargs={'token': self.shared_recipe.access_token})
        response = self.client.post(add_url)

        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['error'], 'preset_limit_exceeded')

    def test_add_shared_recipe_to_preset_limit_exceeded_premium_user(self):
        """有料ユーザーのプリセット枠上限時のエラーハンドリング"""
        # ユーザーを有料ユーザーに設定
        self.user.is_subscribed = True
        self.user.save()

        # プリセット枠を上限まで埋める
        for i in range(self.user.preset_limit):
            create_mock_recipe(
                user=self.user,
                name=f"プリセット{i+1}",
                is_ice=False,
                len_steps=1,
                bean_g=20.0,
                water_ml=200.0,
                memo="プリセット上限テスト"
            )

        add_url = reverse('recipes:add_shared_recipe_to_preset', kwargs={'token': self.shared_recipe.access_token})
        response = self.client.post(add_url)

        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['error'], 'preset_limit_exceeded_premium')

    def test_add_shared_recipe_to_preset_not_found(self):
        """存在しないトークンでのエラーハンドリング"""
        add_url = reverse('recipes:add_shared_recipe_to_preset', kwargs={'token': 'invalid_token'})
        response = self.client.post(add_url)

        self.assertEqual(response.status_code, 404)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['error'], 'not_found')

    def test_add_shared_recipe_to_preset_expired(self):
        """期限切れトークンでのエラーハンドリング"""
        # 期限切れの共有レシピを作成
        expired_recipe = SharedRecipe.objects.create(
            name="期限切れレシピ",
            shared_by_user=self.user,
            is_ice=False,
            len_steps=1,
            bean_g=20.0,
            water_ml=200.0,
            memo="期限切れテスト",
            expires_at=timezone.now() - timedelta(days=1),
            access_token='expired_token_12345678901234567890123456789012'[:32]
        )

        add_url = reverse('recipes:add_shared_recipe_to_preset', kwargs={'token': expired_recipe.access_token})
        response = self.client.post(add_url)

        self.assertEqual(response.status_code, 410)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['error'], 'expired')

    def test_add_shared_recipe_to_preset_not_logged_in(self):
        """未ログインユーザーがプリセット追加を試みた場合のエラーハンドリング"""
        self.client.logout()

        add_url = reverse('recipes:add_shared_recipe_to_preset', kwargs={'token': self.shared_recipe.access_token})
        response = self.client.post(add_url)

        self.assertEqual(response.status_code, 401)  # 認証エラー
        response_data = json.loads(response.content)
        self.assertEqual(response_data['error'], 'authentication_required')
        self.assertIn('ログインが必要です', response_data['message'])

    def test_add_shared_recipe_to_preset_authentication_error_response_format(self):
        """非ログイン状態でのエラーレスポンス形式の確認"""
        self.client.logout()

        add_url = reverse('recipes:add_shared_recipe_to_preset', kwargs={'token': self.shared_recipe.access_token})
        response = self.client.post(add_url)

        self.assertEqual(response.status_code, 401)
        response_data = json.loads(response.content)
        
        # レスポンス形式の確認
        self.assertIn('error', response_data)
        self.assertIn('message', response_data)
        self.assertEqual(response_data['error'], 'authentication_required')
        self.assertTrue(len(response_data['message']) > 0)


class DeleteExpiredSharedRecipesCommandTestCase(TestCase):
    """期限切れ共有レシピ削除コマンドのテスト"""
    
    def setUp(self):
        """テストユーザーの作成とテスト環境の準備"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='securepassword123'
        )
        self.user.is_active = True
        self.user.save()
        
        # テスト用の画像ディレクトリを作成
        self.media_dir = os.path.join(settings.MEDIA_ROOT, 'shared_recipes')
        os.makedirs(self.media_dir, exist_ok=True)
    
    def tearDown(self):
        """テスト後のクリーンアップ"""
        if os.path.exists(self.media_dir):
            for filename in os.listdir(self.media_dir):
                if filename.endswith('.png'):
                    file_path = os.path.join(self.media_dir, filename)
                    os.remove(file_path)
            os.rmdir(self.media_dir)
    
    def create_test_image_file(self, filename, content="test content"):
        """テスト用の画像ファイルを作成"""
        file_path = os.path.join(self.media_dir, filename)
        with open(file_path, 'w') as file:
            file.write(content)
        return file_path
    
    def test_delete_expired_shared_recipes_success(self):
        """期限切れレシピの正常な削除"""
        # テストデータの準備
        access_token = 'expired_token_12345678901234567890123456789012'[:32]
        expired_time = timezone.now() - timedelta(days=1)
        SharedRecipe.objects.create(
            name='期限切れレシピ',
            shared_by_user=self.user,
            is_ice=False,
            len_steps=1,
            bean_g=15.0,
            water_ml=250.0,
            memo='期限切れのテストレシピ',
            expires_at=expired_time,
            access_token=access_token
        )
        self.create_test_image_file(f'{access_token}.png')
        
        # 削除前の状態確認
        self.assertEqual(SharedRecipe.objects.count(), 1)
        image_path = os.path.join(self.media_dir, f'{access_token}.png')
        self.assertTrue(os.path.exists(image_path))
        
        # コマンドの実行（ログ出力抑制）
        call_command('delete_expired_shared_recipes', quiet=True)
        
        # 削除後の状態確認
        self.assertEqual(SharedRecipe.objects.count(), 0)
        self.assertFalse(os.path.exists(image_path))
    
    def test_delete_expired_shared_recipes_with_orphaned_images(self):
        """孤立した画像ファイルも含めて削除"""
        # テストデータの準備
        access_token = 'expired_token_12345678901234567890123456789012'[:32]
        expired_time = timezone.now() - timedelta(days=1)
        SharedRecipe.objects.create(
            name='期限切れレシピ',
            shared_by_user=self.user,
            is_ice=False,
            len_steps=1,
            bean_g=15.0,
            water_ml=250.0,
            memo='期限切れのテストレシピ',
            expires_at=expired_time,
            access_token=access_token
        )
        self.create_test_image_file(f'{access_token}.png')
        self.create_test_image_file('orphaned_image_12345678901234567890123456789012.png')
        
        # 削除前の状態確認
        self.assertEqual(SharedRecipe.objects.count(), 1)
        self.assertEqual(len([f for f in os.listdir(self.media_dir) if f.endswith('.png')]), 2)
        
        # コマンドの実行（ログ出力抑制）
        call_command('delete_expired_shared_recipes', quiet=True)
        
        # 削除後の状態確認
        self.assertEqual(SharedRecipe.objects.count(), 0)
        self.assertEqual(len([f for f in os.listdir(self.media_dir) if f.endswith('.png')]), 0)
    
    def test_delete_expired_shared_recipes_no_expired_recipes(self):
        """期限切れレシピが存在しない場合"""
        # テストデータの準備
        access_token = 'valid_token_12345678901234567890123456789012'[:32]
        valid_time = timezone.now() + timedelta(days=7)
        SharedRecipe.objects.create(
            name='有効なレシピ',
            shared_by_user=self.user,
            is_ice=False,
            len_steps=1,
            bean_g=15.0,
            water_ml=250.0,
            memo='有効なテストレシピ',
            expires_at=valid_time,
            access_token=access_token
        )
        
        # 削除前の状態確認
        initial_count = SharedRecipe.objects.count()
        self.assertEqual(initial_count, 1)
        
        # コマンドの実行（ログ出力抑制）
        call_command('delete_expired_shared_recipes', quiet=True)
        
        # 有効なレシピは削除されていないことを確認
        self.assertEqual(SharedRecipe.objects.count(), 1)
    
    def test_delete_expired_shared_recipes_image_deletion_failure(self):
        """画像ファイル削除の処理確認"""
        # テストデータの準備
        access_token = 'expired_token_12345678901234567890123456789012'[:32]
        expired_time = timezone.now() - timedelta(days=1)
        SharedRecipe.objects.create(
            name='期限切れレシピ',
            shared_by_user=self.user,
            is_ice=False,
            len_steps=1,
            bean_g=15.0,
            water_ml=250.0,
            memo='期限切れのテストレシピ',
            expires_at=expired_time,
            access_token=access_token
        )
        image_path = self.create_test_image_file(f'{access_token}.png')
        
        # 削除前の状態確認
        self.assertEqual(SharedRecipe.objects.count(), 1)
        self.assertTrue(os.path.exists(image_path))
        
        # コマンドの実行（ログ出力抑制）
        call_command('delete_expired_shared_recipes', quiet=True)
        
        # レシピと画像ファイルの両方が削除されることを確認
        self.assertEqual(SharedRecipe.objects.count(), 0)
        self.assertFalse(os.path.exists(image_path))
        
        # 孤立した画像ファイルも削除されることを確認
        self.assertEqual(len([f for f in os.listdir(self.media_dir) if f.endswith('.png')]), 0)
