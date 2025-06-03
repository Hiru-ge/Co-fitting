from django.urls import path
from . import views
from .views import PresetDeleteView

app_name = 'recipes'
urlpatterns = [
    path('', views.index, name='index'),
    path('index', views.index, name='index'),
    path('mypage', views.mypage, name='mypage'),
    path('preset_create', views.preset_create, name='preset_create'),
    path('preset_edit/<recipe_id>', views.preset_edit, name='preset_edit'),
    path('preset_delete/<int:pk>', PresetDeleteView.as_view(), name='preset_delete'),
    path('share/', views.share_recipe, name='share_recipe'),
    path('shared/<str:access_token>/', views.shared_recipe, name='shared_recipe'),
    path('shared/<str:access_token>/add/', views.add_shared_recipe, name='add_shared_recipe'),
]
