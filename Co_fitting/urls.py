from django.contrib.auth.views import LogoutView
from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('index', views.index, name='index'),
    path('login', views.CustomLoginView.as_view(template_name='Co-fitting/login.html'), name='login'),
    path('logout', LogoutView.as_view(), name='logout'),
    path('signup', views.signup, name='signup'),
    path('mypage', views.mypage, name='mypage'),
    path('how-to-use', views.how_to_use, name='how-to-use'),
    path('introduce-preset', views.introduce_preset, name='introduce-preset'),
    path('coffee-theory', views.coffee_theory, name='coffee-theory'),
]
