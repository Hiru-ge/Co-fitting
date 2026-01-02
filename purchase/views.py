from django.shortcuts import render, redirect
from django.urls import reverse
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.http import JsonResponse
import stripe
import json
from .models import StripeService, SubscriptionManager
from Co_fitting.utils.response_helper import ResponseHelper
from Co_fitting.utils.constants import AppConstants


@login_required
def already_subscribed(request):
    return render(request, 'purchase/already_subscribed.html')


@login_required
def create_checkout_session(request):
    # プランタイプを取得（GETまたはPOSTパラメータから）
    plan_type = request.GET.get('plan_type') or request.POST.get('plan_type', AppConstants.PLAN_BASIC)

    # 有効なプランタイプかチェック
    valid_plan_types = [choice[0] for choice in AppConstants.PLAN_CHOICES if choice[0] != AppConstants.PLAN_FREE]
    if plan_type not in valid_plan_types:
        return ResponseHelper.create_error_response("invalid_plan", "無効なプランタイプです。")

    # 既存のサブスクリプションがある場合は別の処理へ誘導
    if request.user.is_subscribed and request.user.stripe_customer_id:
        return ResponseHelper.create_error_response(
            "already_subscribed",
            "既にサブスクリプションがあります。プラン変更をご利用ください。"
        )

    try:
        session = StripeService.create_checkout_session(request.user, request, plan_type)
        return redirect(session.url)
    except Exception as e:
        return ResponseHelper.create_server_error_response(f"エラーが発生しました: {e}")


@login_required
def checkout_success(request):
    return redirect(reverse('mypage') + '?purchase_success=true')


@login_required
def checkout_cancel(request):
    return redirect(reverse('mypage') + '?purchase_cancel=true')


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
        return_url = request.build_absolute_uri(reverse("mypage"))
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


@login_required
@require_http_methods(["POST"])
def change_plan(request):
    """既存サブスクリプションのプラン変更"""
    try:
        data = json.loads(request.body)
        new_plan_type = data.get('plan_type')

        # プランタイプのバリデーション
        valid_plan_types = [choice[0] for choice in AppConstants.PLAN_CHOICES]
        if new_plan_type not in valid_plan_types:
            return JsonResponse({'error': '無効なプランタイプです。'}, status=400)

        # 現在のプランと同じ場合はエラー
        if new_plan_type == request.user.plan_type:
            return JsonResponse({'error': '既に同じプランに加入しています。'}, status=400)

        # サブスクリプションIDを取得
        if not request.user.stripe_customer_id:
            return JsonResponse({'error': 'サブスクリプション情報が見つかりません。'}, status=400)

        stripe.api_key = AppConstants.STRIPE_API_KEY
        subscriptions = stripe.Subscription.list(
            customer=request.user.stripe_customer_id,
            status='active',
            limit=1
        )

        if not subscriptions.data:
            # アクティブなサブスクリプションがない場合
            if new_plan_type == AppConstants.PLAN_FREE:
                # FREEプランへの変更（キャンセル扱い）
                request.user.plan_type = AppConstants.PLAN_FREE
                request.user.is_subscribed = False
                request.user.save()

                # データ削除処理
                old_plan_type = request.user.plan_type
                SubscriptionManager._handle_plan_downgrade_cleanup(
                    request.user, old_plan_type, AppConstants.PLAN_FREE
                )

                return JsonResponse({'success': True, 'message': 'FREEプランに変更しました。'})
            else:
                # 新規チェックアウトセッションを作成
                session = StripeService.create_checkout_session(request.user, request, new_plan_type)
                return JsonResponse({'checkout_url': session.url})

        # アクティブなサブスクリプションがある場合
        subscription_id = subscriptions.data[0].id

        # FREEプランへの変更の場合はサブスクリプションをキャンセル
        if new_plan_type == AppConstants.PLAN_FREE:
            stripe.Subscription.delete(subscription_id)
            return JsonResponse({
                'success': True,
                'message': 'サブスクリプションをキャンセルしました。次回請求日にFREEプランに変更されます。'
            })

        # プラン変更を実行
        StripeService.change_subscription_plan(subscription_id, new_plan_type)

        return JsonResponse({
            'success': True,
            'message': f'{new_plan_type}プランに変更しました。'
        })

    except json.JSONDecodeError:
        return JsonResponse({'error': '無効なリクエストデータです。'}, status=400)
    except Exception as e:
        return JsonResponse({'error': f'エラーが発生しました: {str(e)}'}, status=500)


@login_required
def get_current_plan(request):
    """現在のプラン情報を取得"""
    return JsonResponse({
        'plan_type': request.user.plan_type,
        'preset_limit': request.user.preset_limit_value,
        'share_limit': request.user.share_limit_value,
        'has_pip_access': request.user.has_pip_access,
    })
