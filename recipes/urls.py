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
]
