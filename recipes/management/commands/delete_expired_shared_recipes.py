from django.core.management.base import BaseCommand
from django.utils import timezone
from recipes.models import SharedRecipe
import os
from django.conf import settings

class Command(BaseCommand):
    '期限切れの共有レシピとその画像ファイルを削除する'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--quiet',
            action='store_true',
            help='ログ出力を抑制する',
        )
    
    def handle(self, *args, **kwargs):
        quiet = kwargs.get('quiet', False)
        now = timezone.now()
        expired_recipes = SharedRecipe.objects.filter(expires_at__lt=now)
        count = expired_recipes.count()
        
        if count == 0:
            if not quiet:
                self.stdout.write('期限切れの共有レシピはありません')
            return
        
        if not quiet:
            self.stdout.write(f'期限切れレシピ数: {count}')
            self.stdout.write(f'現在時刻: {now}')
        
        deleted_images = 0
        failed_deletions = []
        
        # 画像ファイルを先に削除（レシピを削除する前に）
        for recipe in expired_recipes:
            img_path = os.path.join(settings.MEDIA_ROOT, 'shared_recipes', f'{recipe.access_token}.png')
            
            if os.path.exists(img_path):
                try:
                    os.remove(img_path)
                    deleted_images += 1
                    if not quiet:
                        self.stdout.write(f'画像ファイル削除成功: {recipe.access_token}.png')
                except Exception as e:
                    failed_deletions.append((recipe.access_token, str(e)))
                    if not quiet:
                        self.stdout.write(self.style.WARNING(f'画像ファイル削除失敗: {recipe.access_token}.png - {e}'))
            else:
                if not quiet:
                    self.stdout.write(f'画像ファイルが見つかりません: {recipe.access_token}.png')
        
        # レシピを削除
        expired_recipes.delete()
        if not quiet:
            self.stdout.write(f'レシピ削除完了: {count}件')
        
        # 孤立した画像ファイルもチェックして削除
        if not quiet:
            self.stdout.write('\n孤立した画像ファイルのチェック中...')
        orphaned_count = self._cleanup_orphaned_images(quiet)
        
        # 結果を表示
        if not quiet:
            self.stdout.write(self.style.SUCCESS(
                f'完了: {count}件の期限切れレシピ、{deleted_images}件の画像ファイル、{orphaned_count}件の孤立した画像ファイルを削除しました'
            ))
            
            if failed_deletions:
                self.stdout.write(self.style.WARNING(f'\n削除に失敗した画像ファイル: {len(failed_deletions)}件'))
                for token, error in failed_deletions[:5]:  # 最初の5件のみ表示
                    self.stdout.write(f'  {token}: {error}')
    
    def _cleanup_orphaned_images(self, quiet=False):
        """孤立した画像ファイルを削除する"""
        shared_recipes_dir = os.path.join(settings.MEDIA_ROOT, 'shared_recipes')
        
        if not os.path.exists(shared_recipes_dir):
            return 0
        
        # データベースに存在するレシピのトークンを取得
        recipe_tokens = set(SharedRecipe.objects.values_list('access_token', flat=True))
        
        # 画像ファイルをチェック
        image_files = [f for f in os.listdir(shared_recipes_dir) if f.endswith('.png')]
        orphaned_images = []
        
        for img_file in image_files:
            token = img_file.replace('.png', '')
            if token not in recipe_tokens:
                orphaned_images.append(img_file)
        
        if not orphaned_images:
            return 0
        
        # 孤立した画像ファイルを削除
        deleted_count = 0
        for img_file in orphaned_images:
            img_path = os.path.join(shared_recipes_dir, img_file)
            try:
                os.remove(img_path)
                deleted_count += 1
            except Exception as e:
                if not quiet:
                    self.stdout.write(self.style.WARNING(f'孤立した画像ファイル削除失敗: {img_file} - {e}'))
        
        if deleted_count > 0 and not quiet:
            self.stdout.write(f'孤立した画像ファイル削除: {deleted_count}件')
        
        return deleted_count 