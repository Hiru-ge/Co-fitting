from shutil import ExecError
from django.shortcuts import render, redirect, get_object_or_404
import secrets
from datetime import timedelta
from django.utils import timezone
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_GET
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from .models import Recipe, RecipeStep, User, SharedRecipe, SharedRecipeStep
from .forms import RecipeForm
from django.urls import reverse_lazy
from django.views.generic import DeleteView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib import messages
import os
from django.conf import settings
from PIL import Image, ImageDraw, ImageFont
import json


class ShareConstants:
    SHARE_LIMIT_PER_WEEK = 10
    SHARE_EXPIRY_DAYS = 7
    TOKEN_LENGTH = 16
    IMAGE_WIDTH = 1000
    BASE_HEIGHT = 500
    ROW_HEIGHT = 42
    CARD_MARGIN = 50
    CARD_RADIUS = 40
    FONT_SIZE_LARGE = 48
    FONT_SIZE_MEDIUM = 38
    FONT_SIZE_SMALL = 28


def get_shared_recipe_or_error(token):
    try:
        shared_recipe = SharedRecipe.objects.get(access_token=token)
    except SharedRecipe.DoesNotExist:
        return None, JsonResponse({
            'error': 'not_found',
            'message': 'この共有リンクは存在しません。'
        }, status=404)

    if shared_recipe.expires_at and shared_recipe.expires_at < timezone.now():
        return None, JsonResponse({
            'error': 'expired',
            'message': 'この共有リンクは期限切れです。'
        }, status=410)

    return shared_recipe, None


def validate_shared_recipe_data(data):
    required_fields = ['name', 'bean_g', 'water_ml', 'is_ice', 'len_steps', 'steps']
    for field in required_fields:
        if field not in data:
            return False, f'{field}がありません'

    if not isinstance(data['steps'], list) or len(data['steps']) != data['len_steps']:
        return False, 'ステップ数が不正です'

    return True, None


def check_share_rate_limit(user):
    one_week_ago = timezone.now() - timedelta(days=ShareConstants.SHARE_EXPIRY_DAYS)
    recent_count = SharedRecipe.objects.filter(
        shared_by_user=user, 
        created_at__gte=one_week_ago
    ).count()

    if recent_count >= ShareConstants.SHARE_LIMIT_PER_WEEK:
        return False, '1週間に共有できるレシピは10個までです。'

    return True, None


def create_shared_recipe_steps_and_image_data(shared_recipe, steps_data):
    steps_for_image = []
    cumulative = 0

    for i, step in enumerate(steps_data):
        pour_ml = step['total_water_ml_this_step']
        cumulative += pour_ml
        SharedRecipeStep.objects.create(
            shared_recipe=shared_recipe,
            step_number=step.get('step_number', i+1),
            minute=step['minute'],
            seconds=step['seconds'],
            total_water_ml_this_step=cumulative
        )

        steps_for_image.append({
            'minute': step['minute'],
            'seconds': step['seconds'],
            'pour_ml': pour_ml,
            'cumulative_water_ml': cumulative
        })

    return steps_for_image


class RecipeImageGenerator:
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
        y = y_position
        draw.text((ShareConstants.CARD_MARGIN+40, y),
                 f"豆量: {self.recipe_data['bean_g']} g",
                 font=font_small, fill=self.text_color)
        y += 36
        draw.text((ShareConstants.CARD_MARGIN+40, y), 
                 f"総湯量: {self.recipe_data['water_ml']} ml", 
                 font=font_small, fill=self.text_color)
        y += 36

        if self.recipe_data.get('ice_g'):
            draw.text((ShareConstants.CARD_MARGIN+40, y), 
                     f"氷量: {self.recipe_data['ice_g']} g", 
                     font=font_small, fill=self.text_color)
            y += 36

        return y

    def _draw_table(self, draw, font_small, start_y):
        table_x = ShareConstants.CARD_MARGIN + 40
        table_y = start_y + 16

        headers = ["経過時間", "注湯量", "総注湯量"]
        for i, header in enumerate(headers):
            draw.text((table_x + i*200, table_y), header,
                     font=font_small, fill=self.text_color)

        row_h = ShareConstants.ROW_HEIGHT
        for i, step in enumerate(self.steps_data):
            sy = table_y + 50 + i*row_h
            time_str = f"{step['minute']:02d}:{step['seconds']:02d}"
            draw.text((table_x, sy), time_str, 
                     font=font_small, fill=self.text_color)
            draw.text((table_x+200, sy), f"{step['pour_ml']} ml",
                     font=font_small, fill=self.text_color)
            draw.text((table_x+400, sy), f"{step['cumulative_water_ml']} ml",
                     font=font_small, fill=self.text_color)

        return sy + row_h + 10

    def generate_image(self, access_token):
        try:
            img = Image.new('RGB', (self.img_width, self.img_height), self.bg_color)
            draw = ImageDraw.Draw(img)

            def rounded_rectangle(draw, xy, radius, fill):
                draw.rounded_rectangle(xy, radius=radius, fill=fill)

            rounded_rectangle(draw, 
                            (ShareConstants.CARD_MARGIN, ShareConstants.CARD_MARGIN,
                             self.img_width-ShareConstants.CARD_MARGIN,
                             self.img_height-ShareConstants.CARD_MARGIN),
                            ShareConstants.CARD_RADIUS, self.card_color)

            font, font_bold, font_small = self._setup_fonts()
            y = self._draw_basic_info(draw, font_small, ShareConstants.CARD_MARGIN+30)
            y2 = self._draw_table(draw, font_small, y)

            total_water = sum(step['pour_ml'] for step in self.steps_data)
            # アイスモードの場合は氷量も加算
            if self.recipe_data.get('is_ice') and self.recipe_data.get('ice_g'):
                try:
                    ice_g = float(self.recipe_data['ice_g'])
                except (ValueError, TypeError):
                    ice_g = 0
                total_water += ice_g
            draw.text((ShareConstants.CARD_MARGIN+40, y2),
                     f"出来上がり量: {int(total_water)} ml",
                     font=font_small, fill=self.text_color)

            pb_text = "Powered by Co-fitting"
            pb_bbox = draw.textbbox((0, 0), pb_text, font=font_small)
            pb_w = pb_bbox[2] - pb_bbox[0]
            pb_h = pb_bbox[3] - pb_bbox[1]
            draw.text((self.img_width-ShareConstants.CARD_MARGIN-pb_w-20,
                      self.img_height-ShareConstants.CARD_MARGIN-pb_h-40),
                     pb_text, font=font_small, fill=self.bg_color)

            # img_dir = os.path.join(settings.BASE_DIR, 'recipes', 'static', 'images', 'shared_recipes')
            img_dir = os.path.join(settings.MEDIA_ROOT, 'shared_recipes')
            os.makedirs(img_dir, exist_ok=True)
            img_filename = f"{access_token}.png"
            img_path = os.path.join(img_dir, img_filename)
            img.save(img_path)

            # return f"/static/images/shared_recipes/{img_filename}"
            return f"{settings.MEDIA_URL}shared_recipes/{img_filename}"

        except Exception as e:
            print('image generation error:', e)
            return None


def index(request):
    user = request.user
    users_preset_recipes = Recipe.objects.filter(create_user=user.id)

    default_preset_user = User.objects.get(username='DefaultPreset')
    default_preset_recipes = Recipe.objects.filter(create_user=default_preset_user.id)

    def recipe_to_dict(recipe):
        steps = RecipeStep.objects.filter(recipe_id=recipe).order_by('step_number')
        steps_data = [{'step_number': step.step_number, 'minute': step.minute, 'seconds': step.seconds, 'total_water_ml_this_step': step.total_water_ml_this_step} for step in steps]
        return {
            'id': recipe.id,
            'name': recipe.name,
            'is_ice': recipe.is_ice,
            'len_steps': recipe.len_steps,
            'bean_g': recipe.bean_g,
            'water_ml': recipe.water_ml,
            'ice_g': recipe.ice_g,
            'steps': steps_data
        }

    shared_recipe_data = None
    shared_token = request.GET.get('shared')

    if shared_token:
        try:
            shared_recipe = SharedRecipe.objects.get(access_token=shared_token)

            if shared_recipe.expires_at and shared_recipe.expires_at < timezone.now():
                shared_recipe_data = {'error': 'expired', 'message': 'この共有リンクは期限切れです。'}
            else:
                steps = SharedRecipeStep.objects.filter(shared_recipe=shared_recipe).order_by('step_number')
                steps_data = [
                    {
                        'step_number': step.step_number,
                        'minute': step.minute,
                        'seconds': step.seconds,
                        'total_water_ml_this_step': step.total_water_ml_this_step
                    }
                    for step in steps
                ]
                shared_recipe_data = {
                    'name': shared_recipe.name,
                    'shared_by_user': shared_recipe.shared_by_user.username,
                    'is_ice': shared_recipe.is_ice,
                    'ice_g': shared_recipe.ice_g,
                    'len_steps': shared_recipe.len_steps,
                    'bean_g': shared_recipe.bean_g,
                    'water_ml': shared_recipe.water_ml,
                    'memo': shared_recipe.memo,
                    'created_at': shared_recipe.created_at,
                    'expires_at': shared_recipe.expires_at,
                    'steps': steps_data,
                    'access_token': shared_recipe.access_token
                }
        except SharedRecipe.DoesNotExist:
            shared_recipe_data = {'error': 'not_found', 'message': 'この共有リンクは存在しません。'}

    context = {
        'users_preset_recipes': [recipe_to_dict(recipe) for recipe in users_preset_recipes],
        'default_preset_recipes': [recipe_to_dict(recipe) for recipe in default_preset_recipes],
        'shared_recipe_data': shared_recipe_data
    }

    return render(request, 'recipes/index.html', context)


@login_required
def mypage(request):
    user = request.user
    recipes = Recipe.objects.filter(create_user=user.id)

    if user.is_subscribed:
        subscription_status = "契約中"
    else:
        subscription_status = "未契約"

    params = {
        'user': user,
        'recipes': recipes,
        'subscription_status': subscription_status,
    }

    return render(request, 'recipes/mypage.html', params)


@login_required
def preset_create(request):
    if request.method == 'POST':
        len_usersPreset = len(Recipe.objects.filter(create_user=request.user))
        canCreate = len_usersPreset < request.user.preset_limit

        if not canCreate:
            messages.success(request, "エラー：プリセットレシピ上限を超過しています")
            recipe_form = RecipeForm()
            return render(request, 'recipes/preset_create.html', {'recipe_form': recipe_form})
        else:
            recipe_form = RecipeForm(request.POST)
            if recipe_form.is_valid():
                recipe = recipe_form.save(commit=False)
                recipe.water_ml = 0
                recipe.create_user = request.user
                recipe.save()

                # RecipeStepフォームの動的データを受け取る
                len_steps = recipe.len_steps
                total_water_ml = 0
                for step_number in range(1, len_steps + 1):
                    total_water_ml_this_step = request.POST.get(f'step{step_number}_water')
                    minute = request.POST.get(f'step{step_number}_minute')
                    second = request.POST.get(f'step{step_number}_second')
                    if total_water_ml_this_step and minute and second:
                        RecipeStep.objects.create(
                            recipe_id=recipe,
                            step_number=step_number,
                            minute=int(minute),
                            seconds=int(second),
                            total_water_ml_this_step=float(total_water_ml_this_step),
                        )
                        total_water_ml = float(total_water_ml_this_step)

                recipe.water_ml = total_water_ml
                recipe.save()

                return redirect('recipes:mypage')
    else:
        recipe_form = RecipeForm()

    return render(request, 'recipes/preset_create.html', {'recipe_form': recipe_form})


@login_required
def preset_edit(request, recipe_id):
    recipe = get_object_or_404(Recipe, id=recipe_id, create_user=request.user)
    steps = RecipeStep.objects.filter(recipe_id=recipe).order_by('step_number')

    if request.method == 'POST':
        recipe_form = RecipeForm(request.POST, instance=recipe)
        if recipe_form.is_valid():
            updated_recipe = recipe_form.save(commit=False)
            updated_recipe.water_ml = 0
            updated_recipe.save()

            RecipeStep.objects.filter(recipe_id=recipe).delete()
            total_water_ml = 0
            for step_number in range(1, updated_recipe.len_steps + 1):
                total_water_ml_this_step = request.POST.get(f'step{step_number}_water')
                minute = request.POST.get(f'step{step_number}_minute')
                second = request.POST.get(f'step{step_number}_second')

                if total_water_ml_this_step and minute and second:
                    RecipeStep.objects.create(
                        recipe_id=updated_recipe,
                        step_number=step_number,
                        minute=int(minute),
                        seconds=int(second),
                        total_water_ml_this_step=float(total_water_ml_this_step),
                    )
                    total_water_ml = float(total_water_ml_this_step)

            updated_recipe.water_ml = total_water_ml
            updated_recipe.save()

            return redirect('recipes:mypage')

    else:
        recipe_form = RecipeForm(instance=recipe)

    return render(request, 'recipes/preset_edit.html', {
        'recipe_form': recipe_form,
        'recipe': recipe,
        'steps': steps
    })


class PresetDeleteView(LoginRequiredMixin, DeleteView):
    model = Recipe
    template_name = 'recipes/preset_delete_confirm.html'
    success_url = reverse_lazy('recipes:mypage')

    def get_queryset(self):
        return Recipe.objects.filter(create_user=self.request.user)


def parse_json_request_data(request):
    try:
        data = json.loads(request.body)
        return data, None
    except json.JSONDecodeError:
        return {}, JsonResponse({
            'error': 'invalid_json', 
            'message': 'JSONデータの形式が正しくありません。'
        }, status=400)


def save_shared_recipe_to_database(user, data, access_token, expires_at):
    return SharedRecipe.objects.create(
        name=data['name'],
        shared_by_user=user,
        is_ice=data['is_ice'],
        ice_g=data.get('ice_g'),
        len_steps=data['len_steps'],
        bean_g=data['bean_g'],
        water_ml=data['water_ml'],
        memo=data.get('memo', ''),
        created_at=timezone.now(),
        expires_at=expires_at,
        access_token=access_token
    )


def build_share_success_response(request, shared_recipe, image_url):
    share_url = request.build_absolute_uri(f'/?shared={shared_recipe.access_token}')
    return JsonResponse({
        'url': share_url, 
        'access_token': shared_recipe.access_token, 
        'expires_at': shared_recipe.expires_at, 
        'image_url': image_url
    })


@csrf_exempt
@require_POST
@login_required
def create_shared_recipe(request):
    user = request.user

    can_share, rate_limit_message = check_share_rate_limit(user)
    if not can_share:
        return JsonResponse({'error': 'share_limit_exceeded', 'message': rate_limit_message}, status=429)

    data, error_response = parse_json_request_data(request)
    if error_response:
        return error_response

    is_valid, validation_message = validate_shared_recipe_data(data)
    if not is_valid:
        return JsonResponse({'error': 'invalid_data', 'message': validation_message}, status=400)

    access_token = secrets.token_hex(ShareConstants.TOKEN_LENGTH)
    expires_at = timezone.now() + timedelta(days=ShareConstants.SHARE_EXPIRY_DAYS)

    shared_recipe = save_shared_recipe_to_database(user, data, access_token, expires_at)
    steps_for_image = create_shared_recipe_steps_and_image_data(shared_recipe, data['steps'])

    image_generator = RecipeImageGenerator(data, steps_for_image)
    image_url = image_generator.generate_image(access_token)

    return build_share_success_response(request, shared_recipe, image_url)


def build_shared_recipe_api_response(shared_recipe):
    steps = SharedRecipeStep.objects.filter(shared_recipe=shared_recipe).order_by('step_number')
    steps_data = [
        {
            'step_number': step.step_number,
            'minute': step.minute,
            'seconds': step.seconds,
            'total_water_ml_this_step': step.total_water_ml_this_step
        }
        for step in steps
    ]

    return {
        'name': shared_recipe.name,
        'shared_by_user': shared_recipe.shared_by_user.username,
        'is_ice': shared_recipe.is_ice,
        'ice_g': shared_recipe.ice_g,
        'len_steps': shared_recipe.len_steps,
        'bean_g': shared_recipe.bean_g,
        'water_ml': shared_recipe.water_ml,
        'memo': shared_recipe.memo,
        'created_at': shared_recipe.created_at,
        'expires_at': shared_recipe.expires_at,
        'steps': steps_data
    }


@require_GET
@csrf_exempt
def retrieve_shared_recipe(request, token):
    shared_recipe, error_response = get_shared_recipe_or_error(token)
    if error_response:
        return error_response

    recipe_data = build_shared_recipe_api_response(shared_recipe)
    return JsonResponse(recipe_data)


def check_user_preset_limit(user):
    current_preset_count = Recipe.objects.filter(create_user=user).count()
    if current_preset_count >= user.preset_limit:
        if user.is_subscribed:
            return False, JsonResponse({
                'error': 'preset_limit_exceeded_premium', 
                'message': 'プリセットの保存上限に達しました。既存のプリセットを整理してください。'
            }, status=400)
        else:
            return False, JsonResponse({
                'error': 'preset_limit_exceeded', 
                'message': 'プリセットの保存上限に達しました。枠を増やすにはサブスクリプションをご検討ください。'
            }, status=400)
    return True, None


def duplicate_shared_recipe_as_preset(shared_recipe, user):
    new_recipe = Recipe.objects.create(
        name=shared_recipe.name,
        create_user=user,
        is_ice=shared_recipe.is_ice,
        ice_g=shared_recipe.ice_g,
        len_steps=shared_recipe.len_steps,
        bean_g=shared_recipe.bean_g,
        water_ml=shared_recipe.water_ml,
        memo=shared_recipe.memo or ''
    )

    shared_steps = SharedRecipeStep.objects.filter(shared_recipe=shared_recipe).order_by('step_number')
    for shared_step in shared_steps:
        RecipeStep.objects.create(
            recipe_id=new_recipe,
            step_number=shared_step.step_number,
            minute=shared_step.minute,
            seconds=shared_step.seconds,
            total_water_ml_this_step=shared_step.total_water_ml_this_step
        )

    return new_recipe


@csrf_exempt
@require_POST
def add_shared_recipe_to_preset(request, token):
    if not request.user.is_authenticated:
        return JsonResponse({
            'error': 'authentication_required',
            'message': 'ログインが必要です。マイプリセットに追加するにはログインしてください。'
        }, status=401)

    shared_recipe, error_response = get_shared_recipe_or_error(token)
    if error_response:
        return error_response

    user = request.user

    can_add, limit_error = check_user_preset_limit(user)
    if not can_add:
        return limit_error

    try:
        new_recipe = duplicate_shared_recipe_as_preset(shared_recipe, user)
        return JsonResponse({
            'success': True, 
            'message': 'レシピをマイプリセットに追加しました。', 
            'recipe_id': new_recipe.id
        })
    except Exception:
        return JsonResponse({
            'error': 'database_error',
            'message': 'レシピの保存に失敗しました。しばらく時間をおいてから再度お試しください。'
        }, status=500)


def shared_recipe_ogp(request, token):
    shared_recipe = get_object_or_404(SharedRecipe, access_token=token)
    image_url = request.build_absolute_uri(f"{settings.MEDIA_URL}shared_recipes/{shared_recipe.access_token}.png")
    context = {
        'shared_recipe': shared_recipe,
        'image_url': image_url,
    }
    return render(request, 'recipes/shared_recipe_ogp.html', context)


@csrf_exempt
@require_POST
@login_required
def delete_all_shared_recipes(request):
    """ユーザーの全共有レシピを一括削除"""
    try:
        # ユーザーの全共有レシピを取得
        shared_recipes = SharedRecipe.objects.filter(shared_by_user=request.user)
        
        # 関連する画像ファイルを削除
        for shared_recipe in shared_recipes:
            image_path = os.path.join(settings.MEDIA_ROOT, 'shared_recipes', f'{shared_recipe.access_token}.png')
            if os.path.exists(image_path):
                os.remove(image_path)
        
        # データベースから削除
        deleted_count = shared_recipes.count()
        shared_recipes.delete()
        
        return JsonResponse({
            'success': True,
            'message': f'{deleted_count}個の共有レシピを削除しました。',
            'deleted_count': deleted_count
        })
    except Exception as e:
        return JsonResponse({
            'error': 'delete_failed',
            'message': '共有レシピの削除に失敗しました。しばらく時間をおいてから再度お試しください。'
        }, status=500)
