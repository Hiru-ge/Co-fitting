from django.shortcuts import render


def how_to_use(request):
    return render(request, 'articles/how-to-use.html')


def introduce_preset(request):
    return render(request, 'articles/introduce-preset.html')


def coffee_theory(request):
    return render(request, 'articles/coffee-theory.html')


def privacy_policy(request):
    return render(request, 'articles/privacy-policy.html')


def commerce_law(request):
    return render(request, 'articles/commerce-law.html')


def mypreset_describe(request):
    return render(request, 'articles/mypreset-describe.html')
