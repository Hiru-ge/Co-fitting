from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from .models import Recipe, RecipeStep, User
from .forms import RecipeForm
from django.urls import reverse_lazy
from django.views.generic import DeleteView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib import messages


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


def how_to_use(request):
    return render(request, 'recipes/how-to-use.html')


def introduce_preset(request):
    return render(request, 'recipes/introduce-preset.html')


def coffee_theory(request):
    return render(request, 'recipes/coffee-theory.html')


def privacy_policy(request):
    return render(request, 'recipes/privacy-policy.html')


def commerce_law(request):
    return render(request, 'recipes/commerce-law.html')


def mypreset_describe(request):
    return render(request, 'recipes/mypreset-describe.html')


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

                return redirect('mypage')
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

            return redirect('mypage')

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
    success_url = reverse_lazy('mypage')

    def get_queryset(self):
        """
        ログインユーザーが作成したレシピのみ削除可能にする。
        """
        return Recipe.objects.filter(create_user=self.request.user)
