from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('index', views.index, name='index'),
    path('login', views.login, name='login'),
    path('loginAuthorize', views.loginAuthorize, name='loginAuthorize'),
    path('mypage', views.mypage, name='mypage'),
    path('precet-create', views.precet_create, name='precet-create'),
    path('how-to-use', views.how_to_use, name='how-to-use'),
    path('introduce-preset', views.introduce_preset, name='introduce-preset'),
    path('coffee-theory', views.coffee_theory, name='coffee-theory'),
]