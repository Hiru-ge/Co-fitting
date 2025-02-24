from django.urls import path
from . import views
from .views import PresetDeleteView

urlpatterns = [
    path('', views.index, name='index'),
    path('index', views.index, name='index'),
    path('mypage', views.mypage, name='mypage'),
    path('how-to-use', views.how_to_use, name='how-to-use'),
    path('introduce-preset', views.introduce_preset, name='introduce-preset'),
    path('coffee-theory', views.coffee_theory, name='coffee-theory'),
    path('privacy-policy', views.privacy_policy, name='privacy-policy'),
    path('preset_create', views.preset_create, name='preset_create'),
    path('preset_edit/<recipe_id>', views.preset_edit, name='preset_edit'),
    path('preset_delete/<int:pk>', PresetDeleteView.as_view(), name='preset_delete'),
]
