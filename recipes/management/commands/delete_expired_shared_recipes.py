from django.core.management.base import BaseCommand
from django.utils import timezone
from recipes.models import SharedRecipe
import os
from django.conf import settings

class Command(BaseCommand):
    '期限切れの共有レシピとその画像ファイルを削除する'
    def handle(self, *args, **kwargs):
        now = timezone.now()
        expired_recipes = SharedRecipe.objects.filter(expires_at__lt=now)
        count = expired_recipes.count()
        for recipe in expired_recipes:
            # 画像ファイルの削除
            img_path = os.path.join(settings.MEDIA_ROOT, 'shared_recipes', f'{recipe.access_token}.png')
            if os.path.exists(img_path):
                os.remove(img_path)
        expired_recipes.delete()
        self.stdout.write(self.style.SUCCESS(f'Successfully deleted {count} expired shared recipes (and images)')) 