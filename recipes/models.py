from django.db import models
import secrets
from users.models import User
from Co_fitting.utils.response_helper import ResponseHelper
from Co_fitting.utils.constants import AppConstants


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
        current_preset_count = cls.objects.filter(created_by=user).count()
        if current_preset_count >= user.preset_limit_value:
            return ResponseHelper.create_error_response(
                'preset_limit_exceeded',
                'プリセットの保存上限に達しました。既存のプリセットを整理してください。'
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
        limit = user.share_limit_value

        if current_count >= limit:
            return ResponseHelper.create_error_response(
                'share_limit_exceeded',
                f'共有できるレシピは{limit}個までです。既存の共有レシピを整理してください。',
                status_code=429,
                details={
                    'current_count': current_count,
                    'limit': limit
                }
            )

        return None

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
        """共有レシピを削除"""
        try:
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
