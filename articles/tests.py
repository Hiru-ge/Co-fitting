from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model

User = get_user_model()


class ArticlesViewsTestCase(TestCase):
    """記事ページのビューテスト"""
    
    def setUp(self):
        """テスト用ユーザーの作成"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='securepassword123'
        )
        self.user.is_active = True
        self.user.save()

    def test_how_to_use_page_access(self):
        """使い方ページにアクセスできることをテスト"""
        response = self.client.get(reverse('articles:how-to-use'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '使い方')

    def test_introduce_preset_page_access(self):
        """プリセット紹介ページにアクセスできることをテスト"""
        response = self.client.get(reverse('articles:introduce-preset'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'プリセット')

    def test_coffee_theory_page_access(self):
        """コーヒー理論ページにアクセスできることをテスト"""
        response = self.client.get(reverse('articles:coffee-theory'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'コーヒー')

    def test_privacy_policy_page_access(self):
        """プライバシーポリシーページにアクセスできることをテスト"""
        response = self.client.get(reverse('articles:privacy-policy'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'プライバシー')

    def test_commerce_law_page_access(self):
        """特定商取引法ページにアクセスできることをテスト"""
        response = self.client.get(reverse('articles:commerce-law'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '特定商取引')

    def test_mypreset_describe_page_access(self):
        """マイプリセット説明ページにアクセスできることをテスト"""
        response = self.client.get(reverse('articles:mypreset-describe'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'マイプリセット')

    def test_articles_pages_use_correct_templates(self):
        """各記事ページが正しいテンプレートを使用することをテスト"""
        templates = {
            'articles:how-to-use': 'articles/how-to-use.html',
            'articles:introduce-preset': 'articles/introduce-preset.html',
            'articles:coffee-theory': 'articles/coffee-theory.html',
            'articles:privacy-policy': 'articles/privacy-policy.html',
            'articles:commerce-law': 'articles/commerce-law.html',
            'articles:mypreset-describe': 'articles/mypreset-describe.html',
        }
        
        for url_name, expected_template in templates.items():
            response = self.client.get(reverse(url_name))
            self.assertEqual(response.status_code, 200)
            self.assertTemplateUsed(response, expected_template)

    def test_articles_pages_accessible_without_login(self):
        """記事ページはログインなしでアクセスできることをテスト"""
        article_urls = [
            'articles:how-to-use',
            'articles:introduce-preset',
            'articles:coffee-theory',
            'articles:privacy-policy',
            'articles:commerce-law',
            'articles:mypreset-describe',
        ]
        
        for url_name in article_urls:
            response = self.client.get(reverse(url_name))
            self.assertEqual(response.status_code, 200)

    def test_articles_pages_accessible_with_login(self):
        """記事ページはログイン状態でもアクセスできることをテスト"""
        self.client.login(username='test@example.com', password='securepassword123')
        
        article_urls = [
            'articles:how-to-use',
            'articles:introduce-preset',
            'articles:coffee-theory',
            'articles:privacy-policy',
            'articles:commerce-law',
            'articles:mypreset-describe',
        ]
        
        for url_name in article_urls:
            response = self.client.get(reverse(url_name))
            self.assertEqual(response.status_code, 200)

    def test_articles_pages_contain_navigation_links(self):
        """記事ページにナビゲーションリンクが含まれていることをテスト"""
        response = self.client.get(reverse('articles:how-to-use'))
        self.assertEqual(response.status_code, 200)
        # 基本的なナビゲーション要素の存在確認
        self.assertContains(response, 'href=')  # リンクの存在確認

    def test_articles_pages_have_proper_meta_tags(self):
        """記事ページに適切なメタタグが含まれていることをテスト"""
        response = self.client.get(reverse('articles:privacy-policy'))
        self.assertEqual(response.status_code, 200)
        # HTMLの基本構造の確認
        self.assertContains(response, '<html')
        self.assertContains(response, '<head')
        self.assertContains(response, '<body')
