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
from django.conf import settings
from django.core.mail import send_mail
# 環境変数の読み込み
env = environ.Env()
env.read_env('../.env')
stripe.api_key = env('STRIPE_API_KEY')


@login_required
def already_subscribed(request):
    return render(request, 'purchase/already_subscribed.html')


@login_required
def create_checkout_session(request):
    if request.user.is_subscribed:
        return render(request, 'purchase/already_subscribed.html')

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price": env('STRIPE_PRICE_ID'),
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
    return redirect(reverse('recipes:mypage') + '?purchase_success=true')


@login_required
def checkout_cancel(request):
    return redirect(reverse('recipes:mypage') + '?purchase_cancel=true')


@login_required
def get_preset_limit(request):
    return JsonResponse({"preset_limit": request.user.preset_limit})


@csrf_exempt
def webhook(request):
    """StripeのWebhookを受け取り、プリセット枠を3つ増やすエンドポイント"""
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
    can_accept_event = [
        'checkout.session.completed',
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'invoice.paid',
        'invoice.payment_failed'
    ]
    if event.type not in can_accept_event:
        return JsonResponse({"error": "Unhandled event type"}, status=400)
    elif event.type == 'checkout.session.completed':
        """ Checkoutセッションが完了したときは、stripeのcustomer_idを取得して、ユーザーに紐付けるだけ
            実際のサブスクリプション有効化処理はinvoice.paidイベントで行う
        """

        session = event.data.object
        customer_id = session.customer

        # ユーザーの特定（カスタムフィールドにユーザーIDを保存している場合）
        user_id = session.get("metadata", {}).get("user_id")
        try:
            user = User.objects.get(id=user_id)
            user.stripe_customer_id = customer_id
            user.save()
            return JsonResponse({"status": "success"})
        except User.DoesNotExist:
            return JsonResponse({"error": "User not found"}, status=404)

    elif event.type in ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted']:
        """ サブスクリプションの状態が変化したときに呼ばれる
            ここでは特に、契約解除の際や支払いが行われなかった際に着目し、サブスクリプション権限の削除を行う
        """
        session = event.data.object
        status = session.status

        try:
            user = User.objects.get(stripe_customer_id=session.customer)
            if status in ['canceled', 'unpaid', 'incomplete_expired', 'past_due']:
                user.is_subscribed = False
                user.preset_limit = 1   # サブスクリプションがキャンセルされた場合、プリセット枠を1に戻す
                users_recipes = Recipe.objects.filter(create_user=user)
                if users_recipes.exists():
                    # ユーザーのレシピが存在する場合、1つだけ残して削除
                    users_recipes.exclude(id=users_recipes.first().id).delete()

            user.save()
            return JsonResponse({"status": "success"})
        except User.DoesNotExist:
            return JsonResponse({"error": "User not found"}, status=404)
    elif event.type == 'invoice.paid':
        # 支払いが成功したタイミングで、サブスクリプションを有効化する
        session = event.data.object
        customer_id = session.customer

        # ユーザーの特定（カスタムフィールドにユーザーIDを保存している場合）
        user_id = session.get("metadata", {}).get("user_id")
        try:
            user = User.objects.get(stripe_customer_id=customer_id)
            user.preset_limit = 4  # プリセット枠を3つ増やして4にする
            user.is_subscribed = True
            user.save()

            subject = "支払い完了通知"
            message = (
                f"{user.username} さん\n\n"
                "Co-fittingのご利用ありがとうございます。\n\n"
                "申請いただいたサブスクリプションの支払いが完了しました。\n\n"
                "これからもCo-fittingをよろしくお願いいたします。\n\n"
            )
            send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
            return JsonResponse({"status": "success"})
        except User.DoesNotExist:
            return JsonResponse({"error": "User not found"}, status=404)
    elif event.type == 'invoice.payment_failed':
        # 支払い失敗時はメール通知を行う(ここではまだサブスクリプションは無効化しない)
        session = event.data.object
        customer_id = session.customer

        try:
            user = User.objects.get(stripe_customer_id=customer_id)
            subject = "支払い失敗通知"
            message = (
                f"{user.username} さん\n\n"
                "Co-fittingのご利用ありがとうございます。\n\n"
                "申請いただいたサブスクリプションの支払いが失敗しました。\n\n"
                "カード情報等をご確認の上、再度お試しください。\n\n"
                "以下のリンクからマイページにアクセスし、登録されているカード情報の更新をお申し込みいただけます。\n\n"
                f"{request.build_absolute_uri(reverse('recipes:mypage'))}\n\n"
            )
            send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
            return JsonResponse({"status": "success"})
        except User.DoesNotExist:
            return JsonResponse({"error": "User not found"}, status=404)
    else:
        return JsonResponse({"error": "UnExpected Error"}, status=500)


@login_required
def create_portal_session(request):
    """顧客ポータルのURLを取得するエンドポイント"""
    if not request.user.stripe_customer_id:
        return render(request, 'purchase/not_subscribed.html')

    customer_id = request.user.stripe_customer_id

    return_url = request.build_absolute_uri(reverse("recipes:mypage"))

    portalSession = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )
    return redirect(portalSession.url)


@login_required
def not_subscribed(request):
    return render(request, 'purchase/not_subscribed.html')
