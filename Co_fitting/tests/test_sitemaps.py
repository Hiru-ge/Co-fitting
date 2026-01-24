"""サイトマップのテスト"""
from django.test import TestCase, Client
from django.urls import reverse
from Co_fitting.tests.helpers import create_test_user
from recipes.models import SharedRecipe, SharedRecipeStep


class SitemapTests(TestCase):
    """サイトマップのテスト"""

    def setUp(self):
        self.client = Client()

    def test_sitemap_returns_200(self):
        """サイトマップが正常に返されること"""
        response = self.client.get('/sitemap.xml')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/xml')

    def test_sitemap_contains_static_pages(self):
        """サイトマップに静的ページが含まれること"""
        response = self.client.get('/sitemap.xml')
        content = response.content.decode('utf-8')

        # トップページ
        self.assertIn('/', content)
        # 使い方ページ
        self.assertIn('/articles/how-to-use/', content)
        # プライバシーポリシー
        self.assertIn('/articles/privacy-policy/', content)
        # 特定商取引法に基づく表記
        self.assertIn('/articles/commerce-law/', content)

    def test_sitemap_contains_shared_recipes(self):
        """サイトマップに共有レシピが含まれること"""
        # テストユーザーを作成
        user = create_test_user()

        # 共有レシピを作成
        shared_recipe = SharedRecipe.objects.create(
            name='Test Recipe',
            created_by=user,
            is_ice=False,
            len_steps=3,
            bean_g=15.0,
            water_ml=225.0,
            access_token='test_token_12345678'
        )
        SharedRecipeStep.objects.create(
            recipe=shared_recipe,
            step_number=1,
            minute=0,
            seconds=30,
            total_water_ml_this_step=50.0
        )

        response = self.client.get('/sitemap.xml')
        content = response.content.decode('utf-8')

        # 共有レシピのURLが含まれること
        self.assertIn('/recipes/share/test_token_12345678/', content)


class RobotsTxtTests(TestCase):
    """robots.txtのテスト"""

    def setUp(self):
        self.client = Client()

    def test_robots_txt_returns_200(self):
        """robots.txtが正常に返されること"""
        response = self.client.get('/robots.txt')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'text/plain')

    def test_robots_txt_contains_sitemap(self):
        """robots.txtにサイトマップURLが含まれること"""
        response = self.client.get('/robots.txt')
        content = response.content.decode('utf-8')

        self.assertIn('Sitemap:', content)
        self.assertIn('sitemap.xml', content)

    def test_robots_txt_disallows_admin(self):
        """robots.txtがadminをDisallowすること"""
        response = self.client.get('/robots.txt')
        content = response.content.decode('utf-8')

        self.assertIn('Disallow: /admin/', content)

    def test_robots_txt_disallows_private_pages(self):
        """robots.txtがプライベートページをDisallowすること"""
        response = self.client.get('/robots.txt')
        content = response.content.decode('utf-8')

        self.assertIn('Disallow: /mypage/', content)
        self.assertIn('Disallow: /users/', content)
        self.assertIn('Disallow: /purchase/', content)
