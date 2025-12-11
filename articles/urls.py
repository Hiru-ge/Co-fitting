from django.urls import path
from . import views

app_name = 'articles'
urlpatterns = [
    path('how-to-use/', views.how_to_use, name='how-to-use'),
    path('introduce-preset/', views.introduce_preset, name='introduce-preset'),
    path('coffee-theory/', views.coffee_theory, name='coffee-theory'),
    path('privacy-policy/', views.privacy_policy, name='privacy-policy'),
    path('commerce-law/', views.commerce_law, name='commerce-law'),
    path('mypreset-describe/', views.mypreset_describe, name='mypreset-describe'),
]
