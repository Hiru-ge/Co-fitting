from shutil import ExecError
from django.shortcuts import render, redirect, get_object_or_404
import secrets
from datetime import timedelta
from django.utils import timezone
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_GET, require_http_methods
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
            'memo': recipe.memo,
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

    def get_queryset(self):
        return Recipe.objects.filter(create_user=self.request.user)
    
    def post(self, request, *args, **kwargs):
        """AJAX削除用のPOSTメソッド"""
        try:
            self.object = self.get_object()
            self.object.delete()
            return JsonResponse({'success': True, 'message': 'プリセットを削除しました。'})
        except Exception as e:
            return JsonResponse({'success': False, 'message': 'プリセットの削除に失敗しました。'}, status=500)


class ShareConstants:
    SHARE_LIMIT_FREE = 1  # 無料ユーザーの共有リンク数制限
    SHARE_LIMIT_PREMIUM = 5  # サブスクユーザーの共有リンク数制限
    TOKEN_LENGTH = 16
    IMAGE_WIDTH = 1000
    BASE_HEIGHT = 500
    ROW_HEIGHT = 42
    CARD_MARGIN = 50
    CARD_RADIUS = 40
    FONT_SIZE_LARGE = 48
    FONT_SIZE_MEDIUM = 38
    FONT_SIZE_SMALL = 28


def get_shared_recipe_or_404(token):
    """共有レシピを取得し、存在・期限チェックを行う"""
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


def check_preset_limit_or_error(user):
    """ユーザーのプリセット上限をチェックし、エラーの場合はレスポンスを返す"""
    current_preset_count = Recipe.objects.filter(create_user=user).count()
    if current_preset_count >= user.preset_limit:
        if user.is_subscribed:
            return JsonResponse({
                'error': 'preset_limit_exceeded_premium', 
                'message': 'プリセットの保存上限に達しました。既存のプリセットを整理してください。'
            }, status=400)
        else:
            return JsonResponse({
                'error': 'preset_limit_exceeded', 
                'message': 'プリセットの保存上限に達しました。枠を増やすにはサブスクリプションをご検討ください。'
            }, status=400)
    return None


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
            # 画像生成エラーは無視
            return None


@csrf_exempt
@require_POST
@login_required
def create_shared_recipe(request):
    user = request.user

    current_count = SharedRecipe.objects.filter(shared_by_user=user).count()
    is_subscribed = getattr(user, 'is_subscribed', False)
    
    if is_subscribed:
        limit = ShareConstants.SHARE_LIMIT_PREMIUM
        limit_message = f'サブスクリプション契約中でも共有できるレシピは{limit}個までです。'
    else:
        limit = ShareConstants.SHARE_LIMIT_FREE
        limit_message = f'共有できるレシピは{limit}個までです。サブスクリプション契約で{ShareConstants.SHARE_LIMIT_PREMIUM}個まで共有可能になります。'
    
    if current_count >= limit:
        return JsonResponse({
            'error': 'share_limit_exceeded', 
            'message': limit_message,
            'current_count': current_count,
            'limit': limit,
            'is_premium': is_subscribed
        }, status=429)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'invalid_json', 'message': 'JSONデータの形式が正しくありません。'}, status=400)

    required_fields = ['name', 'bean_g', 'water_ml', 'is_ice', 'len_steps', 'steps']
    for field in required_fields:
        if field not in data:
            return JsonResponse({'error': 'invalid_data', 'message': f'{field}がありません'}, status=400)

    if not isinstance(data['steps'], list) or len(data['steps']) != data['len_steps']:
        return JsonResponse({'error': 'invalid_data', 'message': 'ステップ数が不正です'}, status=400)

    access_token = secrets.token_hex(ShareConstants.TOKEN_LENGTH)
    # 永続有効化のため、expires_atを非常に遠い未来(100年後)に設定
    expires_at = timezone.now() + timedelta(days=365*100)
    
    shared_recipe = SharedRecipe.objects.create(
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

    steps_for_image = []
    cumulative = 0
    for i, step in enumerate(data['steps']):
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

    image_generator = RecipeImageGenerator(data, steps_for_image)
    image_url = image_generator.generate_image(access_token)

    share_url = request.build_absolute_uri(f'/?shared={shared_recipe.access_token}')
    return JsonResponse({
        'url': share_url, 
        'access_token': shared_recipe.access_token, 
        'expires_at': shared_recipe.expires_at, 
        'image_url': image_url
    })


@csrf_exempt
@require_POST
def add_shared_recipe_to_preset(request, token):
    if not request.user.is_authenticated:
        return JsonResponse({
            'error': 'authentication_required',
            'message': 'ログインが必要です。マイプリセットに追加するにはログインしてください。'
        }, status=401)

    shared_recipe, error_response = get_shared_recipe_or_404(token)
    if error_response:
        return error_response

    user = request.user

    # プリセット上限チェック
    error_response = check_preset_limit_or_error(user)
    if error_response:
        return error_response

    try:
        # 共有レシピをプリセットとして複製
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


@require_GET
@login_required
def get_user_shared_recipes(request):
    try:
        shared_recipes = SharedRecipe.objects.filter(shared_by_user=request.user).order_by('-created_at')
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
        
        return JsonResponse({'shared_recipes': recipes_data})
    except Exception as e:
        return JsonResponse({
            'error': 'fetch_failed',
            'message': '共有レシピ一覧の取得に失敗しました。'
        }, status=500)


@csrf_exempt
@require_POST
@login_required
def share_preset_recipe(request, recipe_id):
    try:
        recipe = get_object_or_404(Recipe, id=recipe_id, create_user=request.user)
        
        current_count = SharedRecipe.objects.filter(shared_by_user=request.user).count()
        is_subscribed = getattr(request.user, 'is_subscribed', False)
        
        if is_subscribed:
            limit = ShareConstants.SHARE_LIMIT_PREMIUM
            limit_message = f'サブスクリプション契約中でも共有できるレシピは{limit}個までです。'
        else:
            limit = ShareConstants.SHARE_LIMIT_FREE
            limit_message = f'共有できるレシピは{limit}個までです。サブスクリプション契約で{ShareConstants.SHARE_LIMIT_PREMIUM}個まで共有可能になります。'
        
        if current_count >= limit:
            return JsonResponse({
                'error': 'share_limit_exceeded', 
                'message': limit_message,
                'current_count': current_count,
                'limit': limit,
                'is_premium': is_subscribed
            }, status=429)
        
        # 共有レシピ作成（永続有効化）
        access_token = secrets.token_hex(ShareConstants.TOKEN_LENGTH)
        expires_at = timezone.now() + timedelta(days=365*100)  # 100年後
        
        shared_recipe = SharedRecipe.objects.create(
            name=recipe.name,
            shared_by_user=request.user,
            is_ice=recipe.is_ice,
            ice_g=recipe.ice_g,
            len_steps=recipe.len_steps,
            bean_g=recipe.bean_g,
            water_ml=recipe.water_ml,
            memo=recipe.memo or '',
            created_at=timezone.now(),
            expires_at=expires_at,
            access_token=access_token
        )
        
        recipe_steps = RecipeStep.objects.filter(recipe_id=recipe).order_by('step_number')
        for step in recipe_steps:
            SharedRecipeStep.objects.create(
                shared_recipe=shared_recipe,
                step_number=step.step_number,
                minute=step.minute,
                seconds=step.seconds,
                total_water_ml_this_step=step.total_water_ml_this_step
            )
        
        steps_data = [{'step_number': step.step_number, 'minute': step.minute, 'seconds': step.seconds, 'total_water_ml_this_step': step.total_water_ml_this_step} for step in recipe_steps]
        recipe_data = {
            'name': recipe.name,
            'bean_g': recipe.bean_g,
            'water_ml': recipe.water_ml,
            'is_ice': recipe.is_ice,
            'ice_g': recipe.ice_g,
            'len_steps': recipe.len_steps,
            'steps': steps_data,
            'memo': recipe.memo or ''
        }
        
        image_generator = RecipeImageGenerator(recipe_data, steps_data)
        image_url = image_generator.generate_image(access_token)
        
        return JsonResponse({
            'access_token': shared_recipe.access_token,
            'image_url': image_url
        })
    except Exception as e:
        return JsonResponse({
            'error': 'share_failed',
            'message': 'プリセットの共有に失敗しました。'
        }, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
@login_required
def delete_shared_recipe(request, token):
    try:
        shared_recipe = get_object_or_404(SharedRecipe, access_token=token, shared_by_user=request.user)
        
        image_path = os.path.join(settings.MEDIA_ROOT, 'shared_recipes', f'{shared_recipe.access_token}.png')
        if os.path.exists(image_path):
            os.remove(image_path)
        
        shared_recipe.delete()
        
        return JsonResponse({
            'success': True,
            'message': '共有レシピを削除しました。'
        })
    except Exception as e:
        return JsonResponse({
            'error': 'delete_failed',
            'message': '共有レシピの削除に失敗しました。'
        }, status=500)


@login_required
def shared_recipe_edit(request, token):
    shared_recipe = get_object_or_404(SharedRecipe, access_token=token, shared_by_user=request.user)
    steps = SharedRecipeStep.objects.filter(shared_recipe=shared_recipe).order_by('step_number')

    if request.method == 'POST':
        shared_recipe.name = request.POST.get('name', shared_recipe.name)
        shared_recipe.len_steps = int(request.POST.get('len_steps', shared_recipe.len_steps))
        shared_recipe.bean_g = float(request.POST.get('bean_g', shared_recipe.bean_g))
        shared_recipe.is_ice = 'is_ice' in request.POST
        shared_recipe.ice_g = float(request.POST.get('ice_g', 0)) if shared_recipe.is_ice else None
        shared_recipe.memo = request.POST.get('memo', shared_recipe.memo)
        
        SharedRecipeStep.objects.filter(shared_recipe=shared_recipe).delete()
        total_water_ml = 0
        
        for step_number in range(1, shared_recipe.len_steps + 1):
            total_water_ml_this_step = request.POST.get(f'step{step_number}_water')
            minute = request.POST.get(f'step{step_number}_minute')
            second = request.POST.get(f'step{step_number}_second')

            if total_water_ml_this_step and minute and second:
                SharedRecipeStep.objects.create(
                    shared_recipe=shared_recipe,
                    step_number=step_number,
                    minute=int(minute),
                    seconds=int(second),
                    total_water_ml_this_step=float(total_water_ml_this_step),
                )
                total_water_ml = float(total_water_ml_this_step)

        shared_recipe.water_ml = total_water_ml
        shared_recipe.save()

        steps_data = [{'step_number': step.step_number, 'minute': step.minute, 'seconds': step.seconds, 'total_water_ml_this_step': step.total_water_ml_this_step} for step in SharedRecipeStep.objects.filter(shared_recipe=shared_recipe).order_by('step_number')]
        recipe_data = {
            'name': shared_recipe.name,
            'bean_g': shared_recipe.bean_g,
            'water_ml': shared_recipe.water_ml,
            'is_ice': shared_recipe.is_ice,
            'ice_g': shared_recipe.ice_g,
            'len_steps': shared_recipe.len_steps,
            'steps': steps_data,
            'memo': shared_recipe.memo or ''
        }
        
        image_generator = RecipeImageGenerator(recipe_data, steps_data)
        image_generator.generate_image(shared_recipe.access_token)

        return redirect('recipes:mypage')

    return render(request, 'recipes/shared_recipe_edit.html', {
        'shared_recipe': shared_recipe,
        'steps': steps
    })


@require_GET
@csrf_exempt
def retrieve_shared_recipe(request, token):
    shared_recipe, error_response = get_shared_recipe_or_404(token)
    if error_response:
        return error_response

    # レスポンスデータ構築
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

    recipe_data = {
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
    
    return JsonResponse(recipe_data)
