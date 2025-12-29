"""
URL configuration for Co_fitting project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from recipes import views as recipe_views
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', recipe_views.index, name='home'),           # トップページ（変換）
    path('index/', recipe_views.index, name='home'),
    path('mypage/', recipe_views.mypage, name='mypage'), # マイページ
    path('recipes/', include('recipes.urls')),           # その他レシピ関連
    path('articles/', include('articles.urls')),
    path('users/', include('users.urls')),
    path('purchase/', include('purchase.urls')),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
