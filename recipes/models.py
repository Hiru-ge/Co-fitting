from django.db import models
import secrets
import os
from django.conf import settings
from PIL import Image, ImageDraw, ImageFont
from users.models import User
from Co_fitting.utils.response_helper import ResponseHelper
from Co_fitting.utils.constants import AppConstants, ImageConstants


class BaseRecipe(models.Model):
    """レシピの基底クラス"""
    name = models.CharField(max_length=30)
    is_ice = models.BooleanField(default=False)
    ice_g = models.FloatField(blank=True, null=True)
    len_steps = models.IntegerField()
    bean_g = models.FloatField()
    water_ml = models.FloatField()
    memo = models.TextField(blank=True, null=True, max_length=300)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)

    class Meta:
        abstract = True

    def for_user(self, user):
        """指定ユーザーのレシピを取得"""
        return self.filter(created_by=user)

    def to_dict(self):
        """レシピを辞書形式に変換するメソッド"""
        # ステップデータを取得
        steps = self.get_steps()
        steps_data = [
            {
                'step_number': step.step_number,
                'minute': step.minute,
                'seconds': step.seconds,
                'total_water_ml_this_step': step.total_water_ml_this_step
            }
            for step in steps
        ]

        # 基本情報を構築
        base_data = {
            'name': self.name,
            'is_ice': self.is_ice,
            'len_steps': self.len_steps,
            'bean_g': self.bean_g,
            'water_ml': self.water_ml,
            'ice_g': self.ice_g,
            'memo': self.memo,
            'steps': steps_data
        }

        # サブクラス固有のデータを追加
        return self.add_specific_fields_to_dict(base_data)

    def get_steps(self):
        """ステップを取得するメソッド（サブクラスで実装）"""
        raise NotImplementedError("サブクラスで実装してください")

    def add_specific_fields_to_dict(self, base_data):
        """サブクラス固有のフィールドを辞書に追加するメソッド（サブクラスで実装）"""
        raise NotImplementedError("サブクラスで実装してください")

    def create_steps_from_form_data(self, form_data):
        """フォームデータからレシピステップを作成する"""
        total_water_ml = 0

        for step_number in range(1, self.len_steps + 1):
            total_water_ml_this_step = form_data.get(f'step{step_number}_water')
            minute = form_data.get(f'step{step_number}_minute')
            second = form_data.get(f'step{step_number}_second')

            if total_water_ml_this_step and minute and second:
                # ステップを作成
                self.create_step(
                    step_number=step_number,
                    minute=int(minute),
                    seconds=int(second),
                    total_water_ml_this_step=float(total_water_ml_this_step)
                )
                total_water_ml = float(total_water_ml_this_step)

        # 最後のステップの総湯量をレシピの総湯量として設定
        if total_water_ml > 0:
            # アイスコーヒーの場合は氷量を足す
            if self.is_ice and self.ice_g:
                self.water_ml = total_water_ml + self.ice_g
            else:
                self.water_ml = total_water_ml
            self.save()

        return self

    def create_step(self, step_number, minute, seconds, total_water_ml_this_step):
        """ステップを作成するメソッド（サブクラスで実装）"""
        raise NotImplementedError("サブクラスで実装してください")

    def update_with_steps(self, form_data):
        """ステップを含めてレシピを更新する"""
        # サブクラスで実装
        raise NotImplementedError("サブクラスで実装してください")

    def update_from_form_data(self, form_data):
        """フォームデータからレシピの基本情報を更新する"""
        self.name = form_data.get('name', self.name)
        self.len_steps = int(form_data.get('len_steps', self.len_steps))
        self.bean_g = float(form_data.get('bean_g', self.bean_g))
        self.is_ice = form_data.get('is_ice') == 'on'
        self.ice_g = float(form_data.get('ice_g', 0)) if self.is_ice else None
        self.memo = form_data.get('memo', self.memo)
        return self


class BaseRecipeStep(models.Model):
    """レシピステップの基底クラス"""
    step_number = models.IntegerField()
    minute = models.IntegerField()
    seconds = models.IntegerField()
    total_water_ml_this_step = models.FloatField()

    class Meta:
        abstract = True
        ordering = ['step_number']

    @property
    def pour_ml_this_step(self):
        """このステップでの注湯量を計算する"""
        if self.step_number == 1:
            return self.total_water_ml_this_step

        # 前のステップの累積湯量を取得
        previous_step = self.__class__.objects.filter(
            recipe=self.recipe,
            step_number=self.step_number - 1
        ).first()

        if previous_step:
            return self.total_water_ml_this_step - previous_step.total_water_ml_this_step

        return self.total_water_ml_this_step

    @property
    def cumulative_water_ml(self):
        """このステップまでの累積湯量を計算する"""
        cumulative = 0
        for step_number in range(1, self.step_number + 1):
            step = self.__class__.objects.filter(
                recipe=self.recipe,
                step_number=step_number
            ).first()
            if step:
                cumulative += step.pour_ml_this_step
        return cumulative


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
        card_height = ImageConstants.BASE_HEIGHT + ImageConstants.ROW_HEIGHT * extra_rows
        self.img_height = card_height + ImageConstants.CARD_MARGIN * 2
        self.img_width = ImageConstants.IMAGE_WIDTH

    def _setup_fonts(self):
        try:
            font_path = "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc"
            font_bold_path = "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc"
            font = ImageFont.truetype(font_path, ImageConstants.FONT_SIZE_MEDIUM)
            font_bold = ImageFont.truetype(font_bold_path, ImageConstants.FONT_SIZE_LARGE)
            font_small = ImageFont.truetype(font_path, ImageConstants.FONT_SIZE_SMALL)
        except Exception:
            font = font_bold = font_small = ImageFont.load_default()

        return font, font_bold, font_small

    def _draw_basic_info(self, draw, font_small, y_position):
        draw.text((ImageConstants.CARD_MARGIN+40, y_position),
                  f"豆量: {int(self.recipe_data['bean_g'])}g", font=font_small, fill=self.text_color)
        y_position += 40
        if self.recipe_data.get('is_ice') and self.recipe_data.get('ice_g'):
            draw.text((ImageConstants.CARD_MARGIN+40, y_position),
                      f"氷量: {int(self.recipe_data['ice_g'])}g", font=font_small, fill=self.text_color)
            y_position += 40
        return y_position

    def _draw_table(self, draw, font_small, start_y):
        table_x = ImageConstants.CARD_MARGIN + 40
        table_y = start_y
        row_h = ImageConstants.ROW_HEIGHT

        # カラム幅の設定
        col1_width = 200  # 時間
        col2_width = 300  # 総注湯量

        # ヘッダー行を描画
        header_y = table_y
        draw.text((table_x, header_y), "時間", font=font_small, fill=self.text_color)
        draw.text((table_x + col1_width, header_y), "総注湯量", font=font_small, fill=self.text_color)

        # データ行を描画
        for i, step in enumerate(self.steps_data):
            y = table_y + (i + 1) * row_h + 10  # ヘッダー分のオフセット
            # 時間表記を0:00形式に変更
            time_str = f"{step['minute']}:{step['seconds']:02d}"
            draw.text((table_x, y), time_str,
                      font=font_small, fill=self.text_color)

            # 総注湯量（pour_mlは既に累積総注湯量、整数表示）
            draw.text((table_x + col1_width, y), f"{int(step['pour_ml'])}ml",
                      font=font_small, fill=self.text_color)

        return table_y + (len(self.steps_data) + 1) * row_h + 20

    def generate_image(self, access_token):
        try:
            img = Image.new('RGB', (self.img_width, self.img_height), self.bg_color)
            draw = ImageDraw.Draw(img)

            def rounded_rectangle(draw, xy, radius, fill):
                draw.rounded_rectangle(xy, radius=radius, fill=fill)

            rounded_rectangle(draw,
                              (
                                  ImageConstants.CARD_MARGIN,
                                  ImageConstants.CARD_MARGIN,
                                  self.img_width - ImageConstants.CARD_MARGIN,
                                  self.img_height - ImageConstants.CARD_MARGIN
                              ),
                              radius=ImageConstants.CARD_RADIUS,
                              fill=self.card_color)

            font, font_bold, font_small = self._setup_fonts()

            # タイトル（レシピ名）
            title_text = self.recipe_data['name']
            title_bbox = draw.textbbox((0, 0), title_text, font=font_bold)
            title_width = title_bbox[2] - title_bbox[0]
            title_x = (self.img_width - title_width) // 2
            draw.text((title_x, ImageConstants.CARD_MARGIN + 30), title_text, font=font_bold, fill=self.text_color)

            # 基本情報
            y_position = ImageConstants.CARD_MARGIN + 100
            y_position = self._draw_basic_info(draw, font_small, y_position)

            # テーブル
            table_start_y = y_position + 20
            table_end_y = self._draw_table(draw, font_small, table_start_y)

            # 出来上がり量の表示
            total_water = self.recipe_data['water_ml']
            # アイスモードの場合は氷量も加算
            if self.recipe_data.get('is_ice') and self.recipe_data.get('ice_g'):
                try:
                    ice_g = float(self.recipe_data['ice_g'])
                except (ValueError, TypeError):
                    ice_g = 0
                total_water += ice_g
            draw.text((ImageConstants.CARD_MARGIN + 40, table_end_y),
                      f"出来上がり量: {int(total_water)} ml",
                      font=font_small, fill=self.text_color)

            # Powered by Co-fittingの表示
            pb_text = "Powered by Co-fitting"
            pb_bbox = draw.textbbox((0, 0), pb_text, font=font_small)
            pb_w = pb_bbox[2] - pb_bbox[0]
            pb_h = pb_bbox[3] - pb_bbox[1]
            draw.text((self.img_width - ImageConstants.CARD_MARGIN - pb_w - 20,
                      self.img_height - ImageConstants.CARD_MARGIN - pb_h - 40),
                      pb_text, font=font_small, fill=self.bg_color)

            # 画像保存
            img_dir = os.path.join(settings.MEDIA_ROOT, 'shared_recipes')
            os.makedirs(img_dir, exist_ok=True)
            img_filename = f"{access_token}.png"
            img_path = os.path.join(img_dir, img_filename)
            img.save(img_path)

            return f"{settings.MEDIA_URL}shared_recipes/{img_filename}"

        except Exception:
            return None


def generate_recipe_image(recipe_data, steps_data, access_token):
    """レシピ画像を生成する共通関数"""
    image_generator = RecipeImageGenerator(recipe_data, steps_data)
    return image_generator.generate_image(access_token)


class PresetRecipe(BaseRecipe):
    """プリセットレシピ"""

    def __str__(self):
        return self.name

    @classmethod
    def default_presets(cls):
        """デフォルトプリセットを取得"""
        default_user = User.objects.get(username='DefaultPreset')
        return cls.objects.filter(created_by=default_user)

    @classmethod
    def get_preset_recipes_for_user(cls, user):
        """ユーザーのプリセットレシピとデフォルトプリセットを取得"""
        user_preset_recipes = cls.objects.filter(created_by=user)
        default_preset_recipes = cls.default_presets()
        return user_preset_recipes, default_preset_recipes

    @classmethod
    def check_preset_limit_or_error(cls, user):
        """ユーザーのプリセット上限をチェックし、エラーの場合はレスポンスを返す"""
        from Co_fitting.utils.constants import AppConstants
        current_preset_count = cls.objects.filter(created_by=user).count()
        if current_preset_count >= user.preset_limit_value:
            if user.plan_type != AppConstants.PLAN_FREE:
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

    def get_steps(self):
        """ステップを取得するメソッド"""
        return PresetRecipeStep.objects.filter(recipe=self).order_by('step_number')

    def add_specific_fields_to_dict(self, base_data):
        """プリセットレシピ固有のフィールドを辞書に追加するメソッド"""
        base_data['id'] = self.id
        return base_data

    def create_step(self, step_number, minute, seconds, total_water_ml_this_step):
        """ステップを作成するメソッド"""
        PresetRecipeStep.objects.create(
            recipe=self,
            step_number=step_number,
            minute=minute,
            seconds=seconds,
            total_water_ml_this_step=total_water_ml_this_step,
        )

    def create_with_user_and_steps(self, form_data, user):
        """ユーザーとステップを含めてレシピを作成する"""
        self.created_by = user
        # まずレシピを保存（water_mlは後で設定）
        self.water_ml = 0  # 一時的に0を設定
        self.save()
        # ステップを作成（water_mlが設定される）
        self.create_steps_from_form_data(form_data)
        return self

    def update_with_steps(self, form_data):
        """ステップを含めてレシピを更新する"""
        self.update_from_form_data(form_data)
        self.save()

        # 既存のステップを削除
        PresetRecipeStep.objects.filter(recipe=self).delete()

        # 新しいステップを作成
        self.create_steps_from_form_data(form_data)
        return self


class PresetRecipeStep(BaseRecipeStep):
    """プリセットレシピステップ"""
    recipe = models.ForeignKey(to=PresetRecipe, on_delete=models.CASCADE, related_name='steps')

    class Meta:
        ordering = ['step_number']  # 手順の順番で並べる

    def __str__(self):
        return f"Step {self.step_number} for {self.recipe.name}"


class SharedRecipe(BaseRecipe):
    """共有レシピ"""
    created_at = models.DateTimeField(auto_now_add=True)
    access_token = models.CharField(max_length=32, unique=True)

    def __str__(self):
        return f"Shared: {self.name} ({self.access_token})"

    @classmethod
    def get_by_token(cls, token):
        """トークンで共有レシピを取得"""
        return cls.objects.filter(access_token=token).first()

    @classmethod
    def get_shared_recipe_data(cls, shared_token):
        """共有レシピデータを取得（エラーハンドリング付き）"""
        if not shared_token:
            return None

        shared_recipe = cls.get_by_token(shared_token)
        if not shared_recipe:
            return {'error': 'not_found', 'message': 'この共有リンクは存在しません。'}

        return shared_recipe.to_dict()

    @classmethod
    def create_shared_recipe_from_data(cls, recipe_data, user):
        """レシピデータから共有レシピを作成する"""
        access_token = secrets.token_hex(AppConstants.TOKEN_LENGTH)

        shared_recipe = cls.objects.create(
            name=recipe_data['name'],
            created_by=user,
            is_ice=recipe_data['is_ice'],
            ice_g=recipe_data.get('ice_g'),
            len_steps=recipe_data['len_steps'],
            bean_g=recipe_data['bean_g'],
            water_ml=recipe_data['water_ml'],
            memo=recipe_data.get('memo', ''),
            access_token=access_token
        )

        # Model層のメソッドを使用してステップを作成
        shared_recipe.create_steps_from_recipe_data(recipe_data)

        return shared_recipe

    @classmethod
    def get_shared_recipe_or_error(cls, token):
        """共有レシピを取得し、存在・期限チェックを行う"""
        shared_recipe = cls.get_by_token(token)
        if not shared_recipe:
            return None, ResponseHelper.create_error_response('not_found', 'この共有リンクは存在しません。', 404)

        return shared_recipe, None

    @classmethod
    def check_share_limit_or_error(cls, user):
        """共有レシピ上限チェック、上限超過の場合はエラーレスポンスを返す"""
        current_count = cls.objects.filter(created_by=user).count()
        is_premium = user.plan_type != AppConstants.PLAN_FREE
        limit = user.share_limit_value

        if is_premium:
            limit_message = f'サブスクリプション契約中でも共有できるレシピは{limit}個までです。'
        else:
            limit_message = f'共有できるレシピは{limit}個までです。サブスクリプション契約で{AppConstants.SHARE_LIMIT_PREMIUM}個まで共有可能になります。'

        if current_count >= limit:
            return ResponseHelper.create_error_response(
                'share_limit_exceeded',
                limit_message,
                status_code=429,
                details={
                    'current_count': current_count,
                    'limit': limit,
                    'is_premium': is_premium
                }
            )

        return None

    @classmethod
    def prepare_image_data(cls, recipe_data):
        """画像生成用のステップデータを準備"""
        steps_for_image = []

        for i, step in enumerate(recipe_data['steps']):
            cumulative_water_ml = step['total_water_ml_this_step']

            steps_for_image.append({
                'minute': step['minute'],
                'seconds': step['seconds'],
                'step_number': step.get('step_number', i+1),
                'pour_ml': cumulative_water_ml,
                'cumulative_water_ml': cumulative_water_ml
            })
        return steps_for_image

    @classmethod
    def copy_to_preset(cls, shared_recipe, user):
        """共有レシピをプリセットとして複製"""
        # プリセット上限チェック
        error_response = PresetRecipe.check_preset_limit_or_error(user)
        if error_response:
            return None, error_response

        try:
            # 共有レシピをプリセットとして複製
            new_recipe = PresetRecipe.objects.create(
                name=shared_recipe.name,
                created_by=user,
                is_ice=shared_recipe.is_ice,
                ice_g=shared_recipe.ice_g,
                len_steps=shared_recipe.len_steps,
                bean_g=shared_recipe.bean_g,
                water_ml=shared_recipe.water_ml,
                memo=shared_recipe.memo or ''
            )

            # ステップを複製
            shared_steps = SharedRecipeStep.objects.filter(recipe=shared_recipe).order_by('step_number')
            for shared_step in shared_steps:
                PresetRecipeStep.objects.create(
                    recipe=new_recipe,
                    step_number=shared_step.step_number,
                    minute=shared_step.minute,
                    seconds=shared_step.seconds,
                    total_water_ml_this_step=shared_step.total_water_ml_this_step
                )

            return new_recipe, None
        except Exception:
            return None, ResponseHelper.create_error_response(
                'database_error',
                'レシピの保存に失敗しました。しばらく時間をおいてから再度お試しください。',
                500
            )

    @classmethod
    def delete_with_image(cls, shared_recipe):
        """共有レシピと画像ファイルを削除"""
        try:
            # 画像ファイルを削除
            image_path = os.path.join(settings.MEDIA_ROOT, 'shared_recipes', f'{shared_recipe.access_token}.png')
            if os.path.exists(image_path):
                os.remove(image_path)

            # 共有レシピを削除
            shared_recipe.delete()

            return ResponseHelper.create_success_response('共有レシピを削除しました。')
        except Exception:
            return ResponseHelper.create_error_response(
                'delete_failed',
                '共有レシピの削除に失敗しました。',
                500
            )

    @classmethod
    def get_user_shared_recipes_data(cls, user):
        """ユーザーの共有レシピ一覧データを取得"""
        try:
            shared_recipes = cls.objects.filter(created_by=user).order_by('-created_at')
            recipes_data = []

            for recipe in shared_recipes:
                recipes_data.append({
                    'access_token': recipe.access_token,
                    'name': recipe.name,
                    'created_at': recipe.created_at.isoformat(),
                    'is_ice': recipe.is_ice,
                    'bean_g': recipe.bean_g,
                    'water_ml': recipe.water_ml,
                    'ice_g': recipe.ice_g,
                    'len_steps': recipe.len_steps,
                    'memo': recipe.memo
                })

            return ResponseHelper.create_data_response({'shared_recipes': recipes_data})
        except Exception:
            return ResponseHelper.create_server_error_response('共有レシピ一覧の取得に失敗しました。')

    def get_steps(self):
        """ステップを取得するメソッド"""
        return SharedRecipeStep.objects.filter(recipe=self).order_by('step_number')

    def add_specific_fields_to_dict(self, base_data):
        """共有レシピ固有のフィールドを辞書に追加するメソッド"""
        base_data['shared_by_user'] = self.created_by.username
        base_data['created_at'] = self.created_at
        base_data['access_token'] = self.access_token
        return base_data

    def create_steps_from_recipe_data(self, recipe_data):
        """レシピデータから共有レシピステップを作成する（累積湯量をそのまま保存）"""
        for i, step in enumerate(recipe_data['steps']):
            # プリセットのtotal_water_ml_this_stepは既に累積湯量なので、そのまま使用
            SharedRecipeStep.objects.create(
                recipe=self,
                step_number=step.get('step_number', i+1),
                minute=step['minute'],
                seconds=step['seconds'],
                total_water_ml_this_step=step['total_water_ml_this_step']
            )
        return self

    def create_step(self, step_number, minute, seconds, total_water_ml_this_step):
        """ステップを作成するメソッド"""
        SharedRecipeStep.objects.create(
            recipe=self,
            step_number=step_number,
            minute=minute,
            seconds=seconds,
            total_water_ml_this_step=total_water_ml_this_step
        )

    def update_with_steps(self, form_data):
        """ステップを含めて共有レシピを更新する"""
        self.update_from_form_data(form_data)
        self.save()  # 基本情報を保存

        # 既存のステップを削除
        SharedRecipeStep.objects.filter(recipe=self).delete()

        # 新しいステップを作成
        self.create_steps_from_form_data(form_data)
        return self


class SharedRecipeStep(BaseRecipeStep):
    """共有レシピステップ"""
    recipe = models.ForeignKey(to=SharedRecipe, on_delete=models.CASCADE, related_name='steps')

    class Meta:
        ordering = ['step_number']

    def __str__(self):
        return f"SharedStep {self.step_number} for {self.recipe.name}"
