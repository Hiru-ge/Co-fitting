from django.shortcuts import render, redirect
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from .models import Recipe
from .forms import SignUpForm


def index(request):
    return render(request, 'Co-fitting/index.html')


def how_to_use(request):
    return render(request, 'Co-fitting/how-to-use.html')


def introduce_preset(request):
    return render(request, 'Co-fitting/introduce-preset.html')


def coffee_theory(request):
    return render(request, 'Co-fitting/coffee-theory.html')


def signup(request):
    if request.method == "POST":
        form = SignUpForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.save()
            login(request, user)
            return redirect("mypage")
    else:
        form = SignUpForm()

    return render(request, "Co-fitting/signup.html", {"form": form})


@login_required
def mypage(request):
    user = request.user
    recipes = Recipe.objects.filter(create_user=user.id)

    params = {
        'user': user,
        'recipes': recipes,
    }

    return render(request, 'Co-fitting/mypage.html', params)
