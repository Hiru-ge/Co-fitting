from django.shortcuts import render, redirect
from django.urls import reverse
from django.contrib.auth.decorators import login_required
import stripe
import environ
from django.http import JsonResponse
from django.http import HttpResponseServerError
from django.views.decorators.csrf import csrf_exempt
import json
from users.models import User
from recipes.models import Recipe
# 環境変数の読み込み
env = environ.Env()
env.read_env('../.env')
stripe.api_key = env('STRIPE_API_KEY')


@login_required
def purchase_describe(request):
    return render(request, 'purchase/purchase_describe.html', {'preset_limit': request.user.preset_limit})


@login_required
def create_checkout_session(request):
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price": "price_1RDOpACGxMrLuNw2jqBXCqUN",  # 作成した` price.id`
                    "quantity": 1,
                },
            ],
            mode="subscription",
            success_url=request.build_absolute_uri(reverse("purchase:checkout_success")) + "?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=request.build_absolute_uri(reverse("purchase:checkout_cancel")),
            metadata={"user_id": request.user.id},  # ユーザーIDを保存
        )
    except Exception as e:
        return HttpResponseServerError(f"Error: {e}")

    return redirect(session.url)


@login_required
def checkout_success(request):
    return render(request, 'purchase/checkout_success.html', {'preset_limit': request.user.preset_limit})


@login_required
def checkout_cancel(request):
    return render(request, 'purchase/checkout_cancel.html')


@login_required
def get_preset_limit(request):
    return JsonResponse({"preset_limit": request.user.preset_limit})


@csrf_exempt
def webhook(request):
    """StripeのWebhookを受け取り、プリセット枠を1つ増やすエンドポイント"""
    payload = request.body
    event = None

    try:
        event = stripe.Event.construct_from(
            json.loads(payload), stripe.api_key
        )
    except ValueError:
        return JsonResponse({"error": "Invalid payload"}, status=400)
    except stripe.error.SignatureVerificationError:
        return JsonResponse({"error": "Invalid signature"}, status=400)

    # 決済成功のイベントを処理
    if event.type == 'checkout.session.completed':
        session = event.data.object

        # ユーザーの特定（カスタムフィールドにユーザーIDを保存している場合）
        user_id = session.get("metadata", {}).get("user_id")
        if user_id:
            try:
                user = User.objects.get(id=user_id)
                user.stripe_customer_id = session.customer
                user.preset_limit = 3  # プリセット枠を増やす(1 → 3)
                user.is_subscribed = True  # サブスクリプション状態を更新
                user.save()
            except User.DoesNotExist:
                return JsonResponse({"error": "User not found"}, status=404)

        return JsonResponse({"status": "success"})
    elif event.type in ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted']:
        session = event.data.object
        customer_id = session.customer
        status = session.status
        try:
            user = User.objects.get(stripe_customer_id=customer_id)
            if status == 'active':
                user.is_subscribed = True
            elif status in ['canceled', 'unpaid', 'incomplete_expired', 'past_due']:
                user.is_subscribed = False
                user.preset_limit = 1

            if not user.is_subscribed:
                user.preset_limit = 1   # サブスクリプションがキャンセルされた場合、プリセット枠を1に戻す
                users_recipes = Recipe.objects.filter(create_user=user)
                if users_recipes.exists():
                    # ユーザーのレシピが存在する場合、1つだけ残して削除
                    users_recipes.exclude(id=users_recipes.first().id).delete()

            user.save()
            return JsonResponse({"status": "success"})
        except User.DoesNotExist:
            return JsonResponse({"error": "User not found"}, status=404)
    else:
        # 不明なイベントタイプの場合、400エラーを返す
        return JsonResponse({"error": "Unhandled event type"}, status=400)


@login_required
def create_portal_session(request):
    """顧客ポータルのURLを取得するエンドポイント"""
    customer_id = request.user.stripe_customer_id

    return_url = request.build_absolute_uri(reverse("mypage"))

    portalSession = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )
    return redirect(portalSession.url)
