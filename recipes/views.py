from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from .models import Recipe, RecipeStep
from .forms import RecipeForm


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
                    water_ml_this_step = request.POST.get(f'step{step_number}_water')
                    minute = request.POST.get(f'step{step_number}_minute')
                    second = request.POST.get(f'step{step_number}_second')
                    if water_ml_this_step and minute and second:
                        RecipeStep.objects.create(
                            recipe_id=recipe,
                            step_number=step_number,
                            minute=int(minute),
                            seconds=int(second),
                            water_ml_this_step=float(water_ml_this_step),
                        )
                        total_water_ml += float(water_ml_this_step)

                recipe.water_ml = total_water_ml
                recipe.save()

                return redirect('mypage')
    else:
        recipe_form = RecipeForm()

    return render(request, 'recipes/preset_create.html', {'recipe_form': recipe_form})
