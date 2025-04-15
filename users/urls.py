from django.contrib.auth.views import LogoutView, PasswordChangeView, PasswordChangeDoneView
from django.contrib.auth.views import PasswordResetView, PasswordResetDoneView, PasswordResetConfirmView, PasswordResetCompleteView
from django.urls import path, reverse_lazy
from . import views
from django.views.generic import TemplateView

app_name = 'users'
urlpatterns = [
    path('login', views.CustomLoginView.as_view(template_name='users/login.html'), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('logout_confirm/', TemplateView.as_view(template_name="users/logout.html"), name='logout_confirm'),
    path('signup/', views.signup_request, name='signup_request'),
    path('signup/confirm/<uidb64>/<token>/<email>', views.signup_confirm, name='signup_confirm'),

    path("email_change/", views.email_change_request, name="email_change_request"),
    path("email_change/confirm/<uidb64>/<token>/<email>/", views.email_change_confirm, name="email_change_confirm"),

    path('password_change/', PasswordChangeView.as_view(template_name='users/password_change.html', success_url=reverse_lazy('users:password_change_done')), name='password_change'),
    path('password_change_done/', PasswordChangeDoneView.as_view(template_name='users/password_change_done.html'), name='password_change_done'),

    path('password_reset/', PasswordResetView.as_view(
            template_name='users/password_reset.html',
            success_url=reverse_lazy('users:password_reset_done'),
            email_template_name='users/password_reset_email.html'), name='password_reset'),
    path('password_reset/done/', PasswordResetDoneView.as_view(
            template_name='users/password_reset_done.html'), name='password_reset_done'),
    path('reset/<uidb64>/<token>/', PasswordResetConfirmView.as_view(
            template_name='users/password_reset_confirm.html',
            success_url=reverse_lazy('users:password_reset_complete')), name='password_reset_confirm'),
    path('reset/done/', PasswordResetCompleteView.as_view(
            template_name='users/password_change_done.html'), name='password_reset_complete'),

    path('account_delete/', views.account_delete, name="account_delete"),

]
