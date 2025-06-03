from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from .models import Recipe, RecipeStep, User, SharedRecipe, SharedRecipeStep
from .forms import RecipeForm
from django.urls import reverse_lazy
from django.views.generic import DeleteView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.utils import timezone
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
            'steps': steps_data
        }

    context = {
        'users_preset_recipes': [recipe_to_dict(recipe) for recipe in users_preset_recipes],
        'default_preset_recipes': [recipe_to_dict(recipe) for recipe in default_preset_recipes]
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
        """
        ログインユーザーが作成したレシピのみ削除可能にする。
        """
        return Recipe.objects.filter(create_user=self.request.user)


@require_http_methods(["POST"])
def share_recipe(request):
    """レシピを共有するためのURLを生成する"""
    try:
        data = json.loads(request.body)

        # 共有レシピを作成
        shared_recipe = SharedRecipe.objects.create(
            name=data['name'],
            shared_by_user=request.user if request.user.is_authenticated else None,
            is_ice=data['is_ice'],
            ice_g=data['ice_g'] if data['is_ice'] else None,
            bean_g=data['bean_g'],
            water_ml=data['water_ml'],
            len_steps=len(data['steps'])
        )

        # ステップを作成
        for step_data in data['steps']:
            SharedRecipeStep.objects.create(
                shared_recipe=shared_recipe,
                step_number=step_data['step_number'],
                minute=step_data['minute'],
                seconds=step_data['seconds'],
                total_water_ml_this_step=step_data['total_water_ml_this_step']
            )

        return JsonResponse({
            'access_token': shared_recipe.access_token
        })

    except Exception as e:
        return JsonResponse({
            'error': str(e)
        }, status=400)


def shared_recipe(request, access_token):
    """共有されたレシピを表示する"""
    try:
        shared_recipe = SharedRecipe.objects.get(access_token=access_token)

        # 有効期限チェック
        if shared_recipe.expires_at and shared_recipe.expires_at < timezone.now():
            return render(request, 'recipes/shared_recipe.html', {
                'error': 'この共有リンクは期限切れです。共有レシピは30日で期限切れになります。'
            })

        return render(request, 'recipes/shared_recipe.html', {
            'shared_recipe': shared_recipe
        })
    except SharedRecipe.DoesNotExist:
        return render(request, 'recipes/shared_recipe.html', {
            'error': 'この共有リンクは無効か、期限切れです。共有レシピは30日で期限切れになります。'
        })


@login_required
@require_http_methods(["POST"])
def add_shared_recipe(request, access_token):
    """共有されたレシピをマイプリセットに追加する"""
    try:
        shared_recipe = SharedRecipe.objects.get(access_token=access_token)

        # 有効期限チェック
        if shared_recipe.expires_at and shared_recipe.expires_at < timezone.now():
            return render(request, 'recipes/shared_recipe.html', {
                'error': 'この共有リンクは期限切れです。共有レシピは30日で期限切れになります。'
            })

        # プリセット枠のチェック
        user_presets = Recipe.objects.filter(create_user=request.user).count()
        if user_presets >= request.user.preset_limit:
            return render(request, 'recipes/shared_recipe.html', {
                'shared_recipe': shared_recipe,
                'error': 'プリセット枠の上限に達しています。'
            })

        # 新しいレシピを作成
        recipe = Recipe.objects.create(
            name=shared_recipe.name,
            create_user=request.user,
            is_ice=shared_recipe.is_ice,
            ice_g=shared_recipe.ice_g,
            bean_g=shared_recipe.bean_g,
            water_ml=shared_recipe.water_ml,
            len_steps=shared_recipe.len_steps
        )

        # ステップを作成
        for shared_step in shared_recipe.sharedrecipestep_set.all():
            RecipeStep.objects.create(
                recipe=recipe,
                step_number=shared_step.step_number,
                minute=shared_step.minute,
                seconds=shared_step.seconds,
                total_water_ml_this_step=shared_step.total_water_ml_this_step
            )

        return redirect('recipes:mypage')
    except SharedRecipe.DoesNotExist:
        return render(request, 'recipes/shared_recipe.html', {
            'error': 'この共有リンクは無効か、期限切れです。共有レシピは30日で期限切れになります。'
        })
