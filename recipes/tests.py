from django.test import TestCase
from django.urls import reverse
from users.models import User
from recipes.models import Recipe, RecipeStep


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
        self.create_url = reverse('preset_create')  # レシピ作成URL

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
        self.recipe = Recipe.objects.create(
            name="編集前レシピ",
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
        self.edit_url = reverse('preset_edit', kwargs={'recipe_id': self.recipe.id})  # レシピ編集URL

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

        self.recipe = Recipe.objects.create(
            name="削除対象レシピ",
            create_user=self.user,
            is_ice=False,
            len_steps=1,
            bean_g=20,
            water_ml=200,
            memo="削除対象のメモ"
        )
        RecipeStep.objects.create(
            recipe_id=self.recipe,
            step_number=1,
            minute=0,
            seconds=0,
            total_water_ml_this_step=200,
        )
        self.delete_url = reverse('preset_delete', kwargs={'pk': self.recipe.id})  # 削除URL

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
