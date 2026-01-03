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
def select_plan(request):
    """プラン選択ページを表示"""
    return render(request, 'purchase/select_plan.html')


@login_required
@require_http_methods(["POST"])
def change_plan(request):
    """既存サブスクリプションのプラン変更（有料プラン間のみ）"""
    try:
        data = json.loads(request.body)
        new_plan_type = data.get('plan_type')

        # プランタイプのバリデーション（有料プランのみ）
        valid_plan_types = [
            AppConstants.PLAN_BASIC,
            AppConstants.PLAN_PREMIUM,
            AppConstants.PLAN_UNLIMITED
        ]
        if new_plan_type not in valid_plan_types:
            return JsonResponse({'error': '無効なプランタイプです。'}, status=400)

        # 現在のプランと同じ場合はエラー
        if new_plan_type == request.user.plan_type:
            return JsonResponse({'error': '既に同じプランに加入しています。'}, status=400)

        # FREEプランのユーザー、またはstripe_customer_idがない場合
        if not request.user.stripe_customer_id or request.user.plan_type == AppConstants.PLAN_FREE:
            # 新規チェックアウトセッションを作成
            session = StripeService.create_checkout_session(request.user, request, new_plan_type)
            return JsonResponse({'checkout_url': session.url})

        # アクティブなサブスクリプションを取得
        stripe.api_key = AppConstants.STRIPE_API_KEY
        subscriptions = stripe.Subscription.list(
            customer=request.user.stripe_customer_id,
            status='active',
            limit=1
        )

        if not subscriptions.data:
            # アクティブなサブスクリプションがない場合、新規チェックアウトへ
            session = StripeService.create_checkout_session(request.user, request, new_plan_type)
            return JsonResponse({'checkout_url': session.url})

        # アクティブなサブスクリプションがある場合、プラン変更を実行
        subscription_id = subscriptions.data[0].id
        old_plan_type = request.user.plan_type

        # ダウングレードかどうかを判定
        plan_order = {
            AppConstants.PLAN_FREE: 0,
            AppConstants.PLAN_BASIC: 1,
            AppConstants.PLAN_PREMIUM: 2,
            AppConstants.PLAN_UNLIMITED: 3
        }
        is_downgrade = plan_order.get(new_plan_type, 0) < plan_order.get(old_plan_type, 0)

        import logging
        logger = logging.getLogger(__name__)
        logger.info(f'プラン変更: {old_plan_type} → {new_plan_type}, ダウングレード: {is_downgrade}')

        # プラン変更を実行
        try:
            StripeService.change_subscription_plan(subscription_id, new_plan_type)
            logger.info(f'Stripe API呼び出し成功: subscription_id={subscription_id}')
        except Exception as stripe_error:
            logger.error(f'Stripe API呼び出し失敗: {str(stripe_error)}')
            raise

        # ユーザー情報を即座に更新（Webhookを待たない）
        request.user.plan_type = new_plan_type
        request.user.preset_limit = AppConstants.PRESET_LIMITS.get(new_plan_type, 1)
        request.user.share_limit = AppConstants.SHARE_LIMITS.get(new_plan_type, 1)
        request.user.save()
        logger.info(f'ユーザー情報更新完了: user_id={request.user.id}')

        # ダウングレード時はデータ削除処理を実行
        if is_downgrade:
            try:
                SubscriptionManager._handle_plan_downgrade_cleanup(
                    request.user, old_plan_type, new_plan_type
                )
                logger.info(f'ダウングレードクリーンアップ完了')
            except Exception as cleanup_error:
                logger.error(f'ダウングレードクリーンアップ失敗: {str(cleanup_error)}')
                raise

        plan_name = dict(AppConstants.PLAN_CHOICES).get(new_plan_type, new_plan_type)
        return JsonResponse({
            'success': True,
            'message': f'{plan_name}プランに変更しました。'
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
