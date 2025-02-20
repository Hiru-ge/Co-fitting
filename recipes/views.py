from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from .models import Recipe, RecipeStep
from .forms import RecipeForm
from django.urls import reverse_lazy
from django.views.generic import DeleteView
from django.contrib.auth.mixins import LoginRequiredMixin


def index(request):
    return render(request, 'recipes/index.html')


def how_to_use(request):
    return render(request, 'recipes/how-to-use.html')


def introduce_preset(request):
    return render(request, 'recipes/introduce-preset.html')


def coffee_theory(request):
    return render(request, 'recipes/coffee-theory.html')


@login_required
def mypage(request):
    user = request.user
    recipes = Recipe.objects.filter(create_user=user.id)

    params = {
        'user': user,
        'recipes': recipes,
    }

    return render(request, 'recipes/mypage.html', params)


@login_required
def preset_create(request):
    if request.method == 'POST':
        len_usersPreset = len(Recipe.objects.filter(create_user=request.user))
        canCreate = len_usersPreset < request.user.preset_limit

        if not canCreate:
            # TODO: エラーは一旦HTMLに表示させるが、いずれはwindow.alertにする
            error_message = "エラー：プリセットレシピ上限を超過しています"
            recipe_form = RecipeForm()
            return render(request, 'recipes/preset_create.html', {'recipe_form': recipe_form, 'error_message': error_message})
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
