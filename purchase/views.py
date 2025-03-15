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
# 環境変数の読み込み
env = environ.Env()
env.read_env('../.env')
stripe.api_key = env('STRIPE_API_KEY')


@login_required
def create_checkout_session(request):
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price": "price_1R2ntWCGxMrLuNw2oi8aH7zs",  # 作成した` price.id`
                    "quantity": 1,
                },
            ],
            mode="payment",
            success_url= request.build_absolute_uri(reverse("purchase:checkout_success")),
            cancel_url= request.build_absolute_uri(reverse("purchase:checkout_cancel")),
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
                user.preset_limit += 1  # プリセット枠を増やす
                user.save()
            except User.DoesNotExist:
                return JsonResponse({"error": "User not found"}, status=404)

        return JsonResponse({"status": "success"})
    else:
        # 不明なイベントタイプの場合、400エラーを返す
        return JsonResponse({"error": "Unhandled event type"}, status=400)
