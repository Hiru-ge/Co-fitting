from django.test import TestCase
from django.urls import reverse
from users.models import User
from recipes.models import Recipe


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
