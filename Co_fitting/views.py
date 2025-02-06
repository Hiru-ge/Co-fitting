from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from .models import Recipe


def index(request):
    return render(request, 'Co-fitting/index.html')


def how_to_use(request):
    return render(request, 'Co-fitting/how-to-use.html')


def introduce_preset(request):
    return render(request, 'Co-fitting/introduce-preset.html')


def coffee_theory(request):
    return render(request, 'Co-fitting/coffee-theory.html')


@login_required
def mypage(request):
    user = request.user
    recipes = Recipe.objects.filter(create_user=user.id)

    params = {
        'user': user,
        'recipes': recipes,
    }

    return render(request, 'Co-fitting/mypage.html', params)