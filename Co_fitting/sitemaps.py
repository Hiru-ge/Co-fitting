"""
サイトマップ生成モジュール

Django Sitemap Frameworkを使用して、検索エンジン向けのサイトマップを生成する。
"""
from django.contrib.sitemaps import Sitemap
from django.urls import reverse
from recipes.models import SharedRecipe


class StaticViewSitemap(Sitemap):
    """静的ページ用のサイトマップ"""
    priority = 0.8
    changefreq = 'monthly'
    protocol = 'https'

    def items(self):
        return [
            'home',
            'landing_page',
            'articles:how-to-use',
            'articles:privacy-policy',
            'articles:commerce-law',
        ]

    def location(self, item):
        return reverse(item)


class SharedRecipeSitemap(Sitemap):
    """共有レシピ用のサイトマップ"""
    priority = 0.5
    changefreq = 'never'
    protocol = 'https'

    def items(self):
        return SharedRecipe.objects.all().order_by('-created_at')

    def location(self, obj):
        return reverse('recipes:shared_recipe_ogp', kwargs={'token': obj.access_token})

    def lastmod(self, obj):
        return obj.created_at


sitemaps = {
    'static': StaticViewSitemap,
    'shared_recipes': SharedRecipeSitemap,
}
