from django.shortcuts import render, redirect
from django.urls import reverse
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
import stripe
from .models import StripeService, SubscriptionManager
from Co_fitting.utils.response_helper import ResponseHelper


@login_required
def already_subscribed(request):
    return render(request, 'purchase/already_subscribed.html')


@login_required
def create_checkout_session(request):
    if request.user.is_subscribed:
        return render(request, 'purchase/already_subscribed.html')

    try:
        session = StripeService.create_checkout_session(request.user, request)
        return redirect(session.url)
    except Exception as e:
        return ResponseHelper.create_server_error_response(f"エラーが発生しました: {e}")


@login_required
def checkout_success(request):
    return redirect(reverse('recipes:mypage') + '?purchase_success=true')


@login_required
def checkout_cancel(request):
    return redirect(reverse('recipes:mypage') + '?purchase_cancel=true')


@login_required
def get_preset_limit(request):
    return ResponseHelper.create_data_response({"preset_limit": request.user.preset_limit})


@csrf_exempt
def webhook(request):
    """StripeのWebhookを受け取り、サブスクリプション状態を管理するエンドポイント"""
    payload = request.body

    try:
        event = StripeService.construct_event(payload, stripe.api_key)
    except ValueError:
        return ResponseHelper.create_error_response("invalid_payload", "Invalid payload")
    except stripe.error.SignatureVerificationError:
        return ResponseHelper.create_error_response("invalid_signature", "Invalid signature")

    # イベントタイプに応じて処理を分岐
    if event.type == 'checkout.session.completed':
        return SubscriptionManager.handle_checkout_session_completed(event)
    elif event.type in ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted']:
        return SubscriptionManager.handle_subscription_change(event)
    elif event.type == 'invoice.paid':
        return SubscriptionManager.handle_invoice_paid(event)
    elif event.type == 'invoice.payment_failed':
        return SubscriptionManager.handle_invoice_payment_failed(event, request)
    else:
        return ResponseHelper.create_error_response("unhandled_event", "Unhandled event type")


@login_required
def create_portal_session(request):
    """顧客ポータルのURLを取得するエンドポイント"""
    if not request.user.stripe_customer_id:
        return render(request, 'purchase/not_subscribed.html')

    try:
        return_url = request.build_absolute_uri(reverse("recipes:mypage"))
        portal_session = StripeService.create_portal_session(
            request.user.stripe_customer_id,
            return_url
        )
        return redirect(portal_session.url)
    except Exception as e:
        return ResponseHelper.create_server_error_response(f"エラーが発生しました: {e}")


@login_required
def not_subscribed(request):
    return render(request, 'purchase/not_subscribed.html')
