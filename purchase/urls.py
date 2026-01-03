from django.urls import path
from . import views

app_name = 'purchase'
urlpatterns = [
    path('create_checkout_session/', views.create_checkout_session, name='create_checkout_session'),
    path('already_subscribed/', views.already_subscribed, name='already_subscribed'),
    path('checkout_success/', views.checkout_success, name='checkout_success'),
    path('checkout_cancel/', views.checkout_cancel, name='checkout_cancel'),
    path('webhook/', views.webhook, name='webhook'),
    path('get_preset_limit/', views.get_preset_limit, name='get_preset_limit'),
    path('create_portal_session/', views.create_portal_session, name='create_portal_session'),
    path('not_subscribed/', views.not_subscribed, name='not_subscribed'),
    path('change_plan/', views.change_plan, name='change_plan'),
    path('get_current_plan/', views.get_current_plan, name='get_current_plan'),
    path('select_plan/', views.select_plan, name='select_plan'),
]
