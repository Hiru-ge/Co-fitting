from django.db import models
from django.utils import timezone
from django.http import JsonResponse
from datetime import timedelta
import secrets
import os
from django.conf import settings
from PIL import Image, ImageDraw, ImageFont
from users.models import User


class ShareConstants:
    """共有レシピ関連の定数"""
    # 共有制限
    SHARE_LIMIT_FREE = 1  # 無料ユーザーの共有リンク数制限
    SHARE_LIMIT_PREMIUM = 5  # サブスクユーザーの共有リンク数制限
    
    # トークン設定
    TOKEN_LENGTH = 16
    
    # 画像生成設定
    IMAGE_WIDTH = 1000
    BASE_HEIGHT = 500
    ROW_HEIGHT = 42
    CARD_MARGIN = 50
    CARD_RADIUS = 40
    FONT_SIZE_LARGE = 48
    FONT_SIZE_MEDIUM = 38
    FONT_SIZE_SMALL = 28
    
    # 期限設定
    DEFAULT_EXPIRY_DAYS = 365 * 100  # 100年後（実質無期限）


class ResponseHelper:
    """レスポンス作成のヘルパークラス"""
    
    @staticmethod
    def create_error_response(error_type, message, status_code=400):
        """統一されたエラーレスポンスを作成"""
        return JsonResponse({
            'error': error_type,
            'message': message
        }, status=status_code)
    
    @staticmethod
    def create_success_response(message, data=None, status_code=200):
        """統一された成功レスポンスを作成"""
        response_data = {
            'success': True,
            'message': message
        }
        if data:
            response_data.update(data)
        return JsonResponse(response_data, status=status_code)


class RecipeManager(models.Manager):
    """レシピ用のカスタムManager"""
    
    def for_user(self, user):
        """指定ユーザーのレシピを取得"""
        return self.filter(create_user=user)
    
    def default_presets(self):
        """デフォルトプリセットを取得"""
        default_user = User.objects.get(username='DefaultPreset')
        return self.filter(create_user=default_user)
    
    def get_preset_recipes_for_user(self, user):
        """ユーザーのプリセットレシピとデフォルトプリセットを取得"""
        user_preset_recipes = self.for_user(user)
        default_preset_recipes = self.default_presets()
        return user_preset_recipes, default_preset_recipes
    
    def check_preset_limit_or_error(self, user):
        """ユーザーのプリセット上限をチェックし、エラーの場合はレスポンスを返す"""
        current_preset_count = self.for_user(user).count()
        if current_preset_count >= user.preset_limit:
            if user.is_subscribed:
                return ResponseHelper.create_error_response(
                    'preset_limit_exceeded_premium', 
                    'プリセットの保存上限に達しました。既存のプリセットを整理してください。'
                )
            else:
                return ResponseHelper.create_error_response(
                    'preset_limit_exceeded', 
                    'プリセットの保存上限に達しました。枠を増やすにはサブスクリプションをご検討ください。'
                )
        return None


class SharedRecipeManager(models.Manager):
    """共有レシピ用のカスタムManager"""
    
    def for_user(self, user):
        """指定ユーザーの共有レシピを取得"""
        return self.filter(shared_by_user=user)
    
    def active(self):
        """有効な共有レシピを取得（期限切れでない）"""
        return self.filter(expires_at__gt=timezone.now())
    
    def expired(self):
        """期限切れの共有レシピを取得"""
        return self.filter(expires_at__lte=timezone.now())
    
    def by_token(self, token):
        """トークンで共有レシピを取得"""
        return self.filter(access_token=token).first()
    
    def get_shared_recipe_data(self, shared_token):
        """共有レシピデータを取得（エラーハンドリング付き）"""
        if not shared_token:
            return None
        
        shared_recipe = self.by_token(shared_token)
        if not shared_recipe:
            return {'error': 'not_found', 'message': 'この共有リンクは存在しません。'}
        
        if shared_recipe.is_expired():
            return {'error': 'expired', 'message': 'この共有リンクは期限切れです。'}
        
        return shared_recipe.to_dict()
    
    def create_shared_recipe_from_data(self, recipe_data, user, expires_at=None):
        """レシピデータから共有レシピを作成する"""
        if expires_at is None:
            expires_at = timezone.now() + timedelta(days=ShareConstants.DEFAULT_EXPIRY_DAYS)
        
        access_token = secrets.token_hex(ShareConstants.TOKEN_LENGTH)
        
        shared_recipe = SharedRecipe.objects.create(
            name=recipe_data['name'],
            shared_by_user=user,
            is_ice=recipe_data['is_ice'],
            ice_g=recipe_data.get('ice_g'),
            len_steps=recipe_data['len_steps'],
            bean_g=recipe_data['bean_g'],
            water_ml=recipe_data['water_ml'],
            memo=recipe_data.get('memo', ''),
            created_at=timezone.now(),
            expires_at=expires_at,
            access_token=access_token
        )
        
        # Model層のメソッドを使用してステップを作成
        shared_recipe.create_steps_from_recipe_data(recipe_data)
        
        return shared_recipe
    
    def get_shared_recipe_or_404(self, token):
        """共有レシピを取得し、存在・期限チェックを行う"""
        shared_recipe = self.by_token(token)
        if not shared_recipe:
            return None, ResponseHelper.create_error_response('not_found', 'この共有リンクは存在しません。', 404)

        if shared_recipe.is_expired():
            return None, ResponseHelper.create_error_response('expired', 'この共有リンクは期限切れです。', 410)

        return shared_recipe, None


class RecipeImageGenerator:
    """レシピ画像生成クラス"""
    
    def __init__(self, recipe_data, steps_data):
        self.recipe_data = recipe_data
        self.steps_data = steps_data
        self._setup_colors()
        self._setup_dimensions()

    def _setup_colors(self):
        if self.recipe_data.get('is_ice'):
            self.bg_color = (162, 169, 175)  # アイスコーヒー用の青系背景
        else:
            self.bg_color = (236, 231, 219)  # 通常コーヒー用の背景
        self.card_color = (71, 71, 71)
        self.text_color = (255, 255, 255)
        self.accent_color = (199, 161, 110)

    def _setup_dimensions(self):
        n_steps = len(self.steps_data)
        extra_rows = max(0, n_steps - 5)
        card_height = ShareConstants.BASE_HEIGHT + ShareConstants.ROW_HEIGHT * extra_rows
        self.img_height = card_height + ShareConstants.CARD_MARGIN * 2
        self.img_width = ShareConstants.IMAGE_WIDTH

    def _setup_fonts(self):
        try:
            font_path = "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc"
            font_bold_path = "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc"
            font = ImageFont.truetype(font_path, ShareConstants.FONT_SIZE_MEDIUM)
            font_bold = ImageFont.truetype(font_bold_path, ShareConstants.FONT_SIZE_LARGE)
            font_small = ImageFont.truetype(font_path, ShareConstants.FONT_SIZE_SMALL)
        except Exception:
            font = font_bold = font_small = ImageFont.load_default()

        return font, font_bold, font_small

    def _draw_basic_info(self, draw, font_small, y_position):
        draw.text((ShareConstants.CARD_MARGIN+40, y_position),
                 f"レシピ名: {self.recipe_data['name']}", font=font_small, fill=self.text_color)
        y_position += 40
        draw.text((ShareConstants.CARD_MARGIN+40, y_position), 
                 f"豆量: {self.recipe_data['bean_g']}g", font=font_small, fill=self.text_color)
        y_position += 40
        if self.recipe_data.get('is_ice') and self.recipe_data.get('ice_g'):
            draw.text((ShareConstants.CARD_MARGIN+40, y_position), 
                     f"氷量: {self.recipe_data['ice_g']}g", font=font_small, fill=self.text_color)
            y_position += 40
        return y_position

    def _draw_table(self, draw, font_small, start_y):
        table_x = ShareConstants.CARD_MARGIN + 40
        table_y = start_y
        row_h = ShareConstants.ROW_HEIGHT

        for i, step in enumerate(self.steps_data):
            y = table_y + i * row_h
            draw.text((table_x, y), f"ステップ{step['step_number']}: {step['minute']}分{step['seconds']}秒", 
                     font=font_small, fill=self.text_color)
            draw.text((table_x + 400, y), f"{step['pour_ml']}ml", 
                     font=font_small, fill=self.text_color)

        sy = table_y + len(self.steps_data) * row_h
        draw.text((table_x, sy), "合計", font=font_small, fill=self.text_color)
        draw.text((table_x + 400, sy), f"{sum(step['pour_ml'] for step in self.steps_data)}ml", 
                 font=font_small, fill=self.text_color)

        return sy + row_h + 10

    def generate_image(self, access_token):
        try:
            img = Image.new('RGB', (self.img_width, self.img_height), self.bg_color)
            draw = ImageDraw.Draw(img)

            def rounded_rectangle(draw, xy, radius, fill):
                draw.rounded_rectangle(xy, radius=radius, fill=fill)

            rounded_rectangle(draw, 
                            (
                                ShareConstants.CARD_MARGIN, 
                                ShareConstants.CARD_MARGIN, 
                                self.img_width - ShareConstants.CARD_MARGIN, 
                                self.img_height - ShareConstants.CARD_MARGIN
                            ), 
                            radius=ShareConstants.CARD_RADIUS, 
                            fill=self.card_color)

            font, font_bold, font_small = self._setup_fonts()

            # タイトル
            title_text = "コーヒーレシピ"
            title_bbox = draw.textbbox((0, 0), title_text, font=font_bold)
            title_width = title_bbox[2] - title_bbox[0]
            title_x = (self.img_width - title_width) // 2
            draw.text((title_x, ShareConstants.CARD_MARGIN + 30), title_text, font=font_bold, fill=self.text_color)

            # 基本情報
            y_position = ShareConstants.CARD_MARGIN + 100
            y_position = self._draw_basic_info(draw, font_small, y_position)

            # テーブル
            table_start_y = y_position + 20
            self._draw_table(draw, font_small, table_start_y)

            # 画像保存
            img_dir = os.path.join(settings.MEDIA_ROOT, 'shared_recipes')
            os.makedirs(img_dir, exist_ok=True)
            img_filename = f"{access_token}.png"
            img_path = os.path.join(img_dir, img_filename)
            img.save(img_path)

            return f"{settings.MEDIA_URL}shared_recipes/{img_filename}"

        except Exception as e:
            return None


def generate_recipe_image(recipe_data, steps_data, access_token):
    """レシピ画像を生成する共通関数"""
    image_generator = RecipeImageGenerator(recipe_data, steps_data)
    return image_generator.generate_image(access_token)


class Recipe(models.Model):
    name = models.CharField(max_length=30)
    create_user = models.ForeignKey(User, on_delete=models.CASCADE)
    is_ice = models.BooleanField(default=False)
    ice_g = models.FloatField(blank=True, null=True)
    len_steps = models.IntegerField()
    bean_g = models.FloatField()
    water_ml = models.FloatField()
    memo = models.TextField(blank=True, null=True, max_length=300)
    
    objects = RecipeManager()

    def __str__(self):
        return self.name
    
    def to_dict(self):
        """レシピを辞書形式に変換するメソッド"""
        steps = RecipeStep.objects.filter(recipe_id=self).order_by('step_number')
        steps_data = [{'step_number': step.step_number, 'minute': step.minute, 'seconds': step.seconds, 'total_water_ml_this_step': step.total_water_ml_this_step} for step in steps]
        return {
            'id': self.id,
            'name': self.name,
            'is_ice': self.is_ice,
            'len_steps': self.len_steps,
            'bean_g': self.bean_g,
            'water_ml': self.water_ml,
            'ice_g': self.ice_g,
            'memo': self.memo,
            'steps': steps_data
        }
    
    def create_steps_from_form_data(self, form_data):
        """フォームデータからレシピステップを作成する"""
        total_water_ml = 0
        for step_number in range(1, self.len_steps + 1):
            total_water_ml_this_step = form_data.get(f'step{step_number}_water')
            minute = form_data.get(f'step{step_number}_minute')
            second = form_data.get(f'step{step_number}_second')
            
            if total_water_ml_this_step and minute and second:
                RecipeStep.objects.create(
                    recipe_id=self,
                    step_number=step_number,
                    minute=int(minute),
                    seconds=int(second),
                    total_water_ml_this_step=float(total_water_ml_this_step),
                )
                total_water_ml = float(total_water_ml_this_step)
        
        # 総湯量を更新
        self.water_ml = total_water_ml
        self.save()
        return self
    
    def update_from_form_data(self, form_data):
        """フォームデータからレシピを更新する"""
        self.name = form_data.get('name', self.name)
        self.len_steps = int(form_data.get('len_steps', self.len_steps))
        self.bean_g = float(form_data.get('bean_g', self.bean_g))
        self.is_ice = form_data.get('is_ice') == 'on'
        self.ice_g = float(form_data.get('ice_g', 0)) if self.is_ice else None
        self.memo = form_data.get('memo', self.memo)
        return self


class RecipeStep(models.Model):
    recipe_id = models.ForeignKey(to=Recipe, on_delete=models.CASCADE, related_name='steps')
    step_number = models.IntegerField()
    minute = models.IntegerField()
    seconds = models.IntegerField()
    total_water_ml_this_step = models.FloatField()

    class Meta:
        ordering = ['step_number']  # 手順の順番で並べる

    def __str__(self):
        return f"Step {self.step_number} for {self.recipe_id.name}"


class SharedRecipe(models.Model):
    name = models.CharField(max_length=30)
    shared_by_user = models.ForeignKey(User, on_delete=models.CASCADE, null=False)
    is_ice = models.BooleanField(default=False)
    ice_g = models.FloatField(blank=True, null=True)
    len_steps = models.IntegerField()
    bean_g = models.FloatField()
    water_ml = models.FloatField()
    memo = models.TextField(blank=True, null=True, max_length=300)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    access_token = models.CharField(max_length=32, unique=True)
    
    objects = SharedRecipeManager()

    def __str__(self):
        return f"Shared: {self.name} ({self.access_token})"
    
    def to_dict(self):
        """共有レシピを辞書形式に変換するメソッド"""
        steps = SharedRecipeStep.objects.filter(shared_recipe=self).order_by('step_number')
        steps_data = [{'step_number': step.step_number, 'minute': step.minute, 'seconds': step.seconds, 'total_water_ml_this_step': step.total_water_ml_this_step} for step in steps]
        return {
            'name': self.name,
            'shared_by_user': self.shared_by_user.username,
            'is_ice': self.is_ice,
            'ice_g': self.ice_g,
            'len_steps': self.len_steps,
            'bean_g': self.bean_g,
            'water_ml': self.water_ml,
            'memo': self.memo,
            'created_at': self.created_at,
            'expires_at': self.expires_at,
            'access_token': self.access_token,
            'steps': steps_data
        }
    
    def is_expired(self):
        """共有レシピが期限切れかどうかを判定する"""
        from django.utils import timezone
        return self.expires_at and self.expires_at < timezone.now()
    
    def create_steps_from_recipe_data(self, recipe_data):
        """レシピデータから共有レシピステップを作成する（累積湯量を計算）"""
        cumulative = 0
        for i, step in enumerate(recipe_data['steps']):
            # 各ステップの注湯量を累積湯量に加算
            pour_ml = step['total_water_ml_this_step']
            cumulative += pour_ml
            
            SharedRecipeStep.objects.create(
                shared_recipe=self,
                step_number=step.get('step_number', i+1),
                minute=step['minute'],
                seconds=step['seconds'],
                total_water_ml_this_step=cumulative
            )
        return self


class SharedRecipeStep(models.Model):
    shared_recipe = models.ForeignKey(to=SharedRecipe, on_delete=models.CASCADE, related_name='steps')
    step_number = models.IntegerField()
    minute = models.IntegerField()
    seconds = models.IntegerField()
    total_water_ml_this_step = models.FloatField()

    class Meta:
        ordering = ['step_number']

    def __str__(self):
        return f"SharedStep {self.step_number} for {self.shared_recipe.name}"
