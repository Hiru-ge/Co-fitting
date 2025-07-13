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
    path('api/shared-recipes', views.create_shared_recipe, name='create_shared_recipe'),
    path('api/shared-recipes/<str:token>', views.retrieve_shared_recipe, name='retrieve_shared_recipe'),
    path('api/shared-recipes/<str:token>/add-to-preset', views.add_shared_recipe_to_preset, name='add_shared_recipe_to_preset'),
    path('share/<str:token>/', views.shared_recipe_ogp, name='shared_recipe_ogp'),
]
