from django.shortcuts import render


def index(request):
    return render(request, 'Co-fitting/index.html')


def how_to_use(request):
    return render(request, 'Co-fitting/how-to-use.html')


def introduce_preset(request):
    return render(request, 'Co-fitting/introduce-preset.html')


def coffee_theory(request):
    return render(request, 'Co-fitting/coffee-theory.html')
