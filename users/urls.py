from django.contrib.auth.views import LogoutView
from django.urls import path
from . import views

app_name = 'users'
urlpatterns = [
    path('login', views.CustomLoginView.as_view(template_name='users/login.html'), name='login'),
    path('logout', LogoutView.as_view(), name='logout'),
    path('signup', views.signup, name='signup'),
    path('change-email', views.change_email, name='change-email'),
]
