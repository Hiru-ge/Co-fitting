from django.shortcuts import render, redirect, get_object_or_404
from django.views.decorators.http import require_POST, require_GET, require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from .models import (
    PresetRecipe, PresetRecipeStep, User, SharedRecipe, SharedRecipeStep,
    generate_recipe_image
)
from Co_fitting.utils.response_helper import ResponseHelper
from .forms import RecipeForm, SharedRecipeDataForm
from django.views.generic import DeleteView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib import messages
from django.conf import settings
import json


def index(request):
    """メインページの表示"""
    user = request.user
    shared_token = request.GET.get('shared')

    # 匿名ユーザーの場合は空のリストを返す
    if user.is_anonymous:
        user_preset_recipes = []
        default_preset_recipes = PresetRecipe.default_presets()
    else:
        user_preset_recipes, default_preset_recipes = PresetRecipe.get_preset_recipes_for_user(user)

    shared_recipe_data = SharedRecipe.get_shared_recipe_data(shared_token)

    context = {
        'user_preset_recipes': [recipe.to_dict() for recipe in user_preset_recipes],
        'default_preset_recipes': [recipe.to_dict() for recipe in default_preset_recipes],
        'shared_recipe_data': shared_recipe_data
    }
    return render(request, 'recipes/index.html', context)


@login_required
def mypage(request):
    user = request.user
    recipes = PresetRecipe.objects.filter(created_by=user)

    # サブスクリプション状態を取得（Model層で実行）
    subscription_status = User.objects.get_subscription_status(user)

    params = {
        'user': user,
        'recipes': recipes,
        'subscription_status': subscription_status,
    }

    return render(request, 'recipes/mypage.html', params)


@login_required
def preset_create(request):
    if request.method == 'POST':
        # プリセット上限チェック（Model層で実行）
        error_response = PresetRecipe.check_preset_limit_or_error(request.user)
        if error_response:
            messages.error(request, "エラー：プリセットレシピ上限を超過しています")
            recipe_form = RecipeForm()
            return render(request, 'recipes/preset_create.html', {'recipe_form': recipe_form})

        # レシピデータのバリデーション
        recipe_form = RecipeForm(request.POST)
        if recipe_form.is_valid():
            recipe = recipe_form.save(commit=False)

            # Model層のメソッドを使用してレシピとステップを作成
            recipe.create_with_user_and_steps(request.POST, request.user)

            return redirect('recipes:mypage')
    else:
        recipe_form = RecipeForm()

    return render(request, 'recipes/preset_create.html', {'recipe_form': recipe_form})


@login_required
def preset_edit(request, recipe_id):
    recipe = get_object_or_404(PresetRecipe, id=recipe_id, created_by=request.user)
    steps = PresetRecipeStep.objects.filter(recipe=recipe).order_by('step_number')

    if request.method == 'POST':
        recipe_form = RecipeForm(request.POST, instance=recipe)
        if recipe_form.is_valid():
            updated_recipe = recipe_form.save(commit=False)

            # Model層のメソッドを使用してレシピとステップを更新
            updated_recipe.update_with_steps(request.POST)

            return redirect('recipes:mypage')

    else:
        recipe_form = RecipeForm(instance=recipe)

    return render(request, 'recipes/preset_edit.html', {
        'recipe_form': recipe_form,
        'recipe': recipe,
        'steps': steps
    })


class PresetDeleteView(LoginRequiredMixin, DeleteView):
    model = PresetRecipe

    def get_queryset(self):
        return PresetRecipe.objects.filter(created_by=self.request.user)

    def post(self, request, *args, **kwargs):
        """AJAX削除用のPOSTメソッド"""
        try:
            self.object = self.get_object()
            self.object.delete()
            return ResponseHelper.create_success_response('プリセットを削除しました。')
        except Exception as e:
            return ResponseHelper.create_error_response('delete_failed', 'プリセットの削除に失敗しました。', 500)


@csrf_exempt
@require_POST
@login_required
def create_shared_recipe(request):
    user = request.user

    # 共有レシピ上限チェック（Model層で実行）
    error_response = SharedRecipe.check_share_limit_or_error(user)
    if error_response:
        return error_response

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return ResponseHelper.create_error_response('invalid_json', 'JSONデータの形式が正しくありません。')

    # Form層でデータ検証
    form = SharedRecipeDataForm(data)
    if not form.is_valid():
        return ResponseHelper.create_validation_error_response(form.errors)

    # 共通関数を使用して共有レシピを作成
    shared_recipe = SharedRecipe.create_shared_recipe_from_data(data, user)

    # 画像生成用のステップデータを準備（Model層で実行）
    steps_for_image = SharedRecipe.prepare_image_data(data)

    # 画像を生成
    image_path = generate_recipe_image(data, steps_for_image, shared_recipe.access_token)

    share_url = request.build_absolute_uri(f'/?shared={shared_recipe.access_token}')
    return ResponseHelper.create_success_response(
        '共有レシピを作成しました。',
        {
            'url': share_url,
            'access_token': shared_recipe.access_token,
            'image_url': image_path
        }
    )


@csrf_exempt
@require_POST
def add_shared_recipe_to_preset(request, token):
    if not request.user.is_authenticated:
        return ResponseHelper.create_authentication_error_response(
            'ログインが必要です。マイプリセットに追加するにはログインしてください。'
        )

    shared_recipe, error_response = SharedRecipe.get_shared_recipe_or_404(token)
    if error_response:
        return error_response

    user = request.user

    # 共有レシピをプリセットとして複製（Model層で実行）
    new_recipe, error_response = SharedRecipe.copy_to_preset(shared_recipe, user)
    if error_response:
        return error_response

    return ResponseHelper.create_success_response(
        'レシピをマイプリセットに追加しました。',
        {'recipe_id': new_recipe.id}
    )


def shared_recipe_ogp(request, token):
    shared_recipe = SharedRecipe.by_token(token)
    if not shared_recipe:
        from django.http import Http404
        raise Http404("共有レシピが見つかりません。")
    image_url = request.build_absolute_uri(f"{settings.MEDIA_URL}shared_recipes/{shared_recipe.access_token}.png")
    context = {
        'shared_recipe': shared_recipe,
        'image_url': image_url,
    }
    return render(request, 'recipes/shared_recipe_ogp.html', context)


@require_GET
@login_required
def get_user_shared_recipes(request):
    # ユーザーの共有レシピ一覧データを取得（Model層で実行）
    return SharedRecipe.get_user_shared_recipes_data(request.user)


@csrf_exempt
@require_POST
@login_required
def share_preset_recipe(request, recipe_id):
    try:
        recipe = get_object_or_404(PresetRecipe, id=recipe_id, created_by=request.user)

        # 共有レシピ上限チェック（Model層で実行）
        error_response = SharedRecipe.check_share_limit_or_error(request.user)
        if error_response:
            return error_response

        # レシピデータを準備（Model層で実行）
        recipe_data = recipe.to_dict()

        # 共通関数を使用して共有レシピを作成
        shared_recipe = SharedRecipe.create_shared_recipe_from_data(recipe_data, request.user)

        # 画像生成用のステップデータを準備（Model層で実行）
        steps_for_image = SharedRecipe.prepare_image_data(recipe_data)

        # 共通関数を使用して画像を生成
        image_url = generate_recipe_image(recipe_data, steps_for_image, shared_recipe.access_token)

        return ResponseHelper.create_success_response(
            'プリセットを共有しました。',
            {
                'access_token': shared_recipe.access_token,
                'image_url': image_url
            }
        )
    except Exception as e:
        return ResponseHelper.create_server_error_response('プリセットの共有に失敗しました。')


@csrf_exempt
@require_http_methods(["DELETE"])
@login_required
def delete_shared_recipe(request, token):
    shared_recipe = SharedRecipe.by_token(token)
    if not shared_recipe or shared_recipe.created_by != request.user:
        return ResponseHelper.create_not_found_error_response('共有レシピが見つかりません。')

    # 共有レシピと画像ファイルを削除（Model層で実行）
    return SharedRecipe.delete_with_image(shared_recipe)


@login_required
def shared_recipe_edit(request, token):
    shared_recipe = get_object_or_404(SharedRecipe, access_token=token, created_by=request.user)
    steps = SharedRecipeStep.objects.filter(shared_recipe=shared_recipe).order_by('step_number')

    if request.method == 'POST':
        # Form層でバリデーション
        recipe_form = RecipeForm(request.POST)
        if recipe_form.is_valid():
            # Model層のメソッドを使用してレシピとステップを更新
            shared_recipe.update_with_steps(request.POST)

            # レシピデータを準備（Model層で実行）
            recipe_data = shared_recipe.to_dict()

            # 画像生成用のステップデータを準備（Model層で実行）
            steps_for_image = SharedRecipe.prepare_image_data(recipe_data)

            # 共通関数を使用して画像を生成
            generate_recipe_image(recipe_data, steps_for_image, shared_recipe.access_token)

            return redirect('recipes:mypage')
        else:
            # フォームエラーの場合は再表示
            steps = SharedRecipeStep.objects.filter(shared_recipe=shared_recipe).order_by('step_number')

    return render(request, 'recipes/shared_recipe_edit.html', {
        'shared_recipe': shared_recipe,
        'steps': steps,
        'recipe_form': recipe_form if request.method == 'POST' else RecipeForm(instance=shared_recipe)
    })


@require_GET
@csrf_exempt
def retrieve_shared_recipe(request, token):
    shared_recipe, error_response = SharedRecipe.get_shared_recipe_or_404(token)
    if error_response:
        return error_response

    # モデルメソッドを使用してレスポンスデータを構築
    return ResponseHelper.create_data_response(shared_recipe.to_dict())


@require_GET
def get_preset_recipes(request):
    """プリセットレシピデータを取得するAPIエンドポイント"""
    try:
        user = request.user

        # 匿名ユーザーの場合は空のリストを返す
        if user.is_anonymous:
            user_preset_recipes = []
            default_preset_recipes = PresetRecipe.default_presets()
        else:
            user_preset_recipes, default_preset_recipes = PresetRecipe.get_preset_recipes_for_user(user)

        return ResponseHelper.create_data_response({
            'user_preset_recipes': [recipe.to_dict() for recipe in user_preset_recipes],
            'default_preset_recipes': [recipe.to_dict() for recipe in default_preset_recipes]
        })
    except Exception as e:
        return ResponseHelper.create_server_error_response('プリセットレシピの取得に失敗しました。')
