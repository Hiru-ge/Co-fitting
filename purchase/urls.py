
from django.urls import path
from . import views

app_name = 'purchase'
urlpatterns = [
    path('create_checkout_session', views.create_checkout_session, name='create_checkout_session'),
    path('checkout_success', views.checkout_success, name='checkout_success'),
    path('checkout_cancel', views.checkout_cancel, name='checkout_cancel'),
    path('webhook', views.webhook, name='webhook'),
    path('get_preset_limit', views.get_preset_limit, name='get_preset_limit'),
]
