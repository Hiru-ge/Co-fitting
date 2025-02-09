from django.contrib.auth.views import LogoutView
from django.urls import path
from . import views

app_name = 'users'
urlpatterns = [
    path('login', views.CustomLoginView.as_view(template_name='users/login.html'), name='login'),
    path('logout', LogoutView.as_view(), name='logout'),
    path('signup/', views.signup_request, name='signup_request'),
    path('signup/confirm/<uidb64>/<token>/<email>', views.signup_confirm, name='signup_confirm'),
    path("change-email/", views.change_email_request, name="change_email_request"),
    path("change-email/confirm/<uidb64>/<token>/<email>/", views.change_email_confirm, name="change_email_confirm"),
]
