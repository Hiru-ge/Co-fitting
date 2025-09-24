from django.db import models
from django.http import JsonResponse
from django.core.mail import send_mail
from django.conf import settings
from django.urls import reverse
import stripe
from users.models import User
from recipes.models import Recipe


class SubscriptionConstants:
    """サブスクリプション関連の定数"""
    # プリセット制限
    FREE_PRESET_LIMIT = 1
    PREMIUM_PRESET_LIMIT = 4
    
    # サブスクリプション状態
    ACTIVE_STATUSES = ['active', 'trialing']
    INACTIVE_STATUSES = ['canceled', 'unpaid', 'incomplete_expired', 'past_due']
    
    # Stripe設定
    STRIPE_API_KEY = settings.STRIPE_API_KEY
    STRIPE_PRICE_ID = settings.STRIPE_PRICE_ID


class StripeService:
    """Stripe API処理のサービスクラス"""
    
    @staticmethod
    def create_checkout_session(user, request):
        """チェックアウトセッションを作成"""
        try:
            stripe.api_key = SubscriptionConstants.STRIPE_API_KEY
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[
                    {
                        "price": SubscriptionConstants.STRIPE_PRICE_ID,
                        "quantity": 1,
                    },
                ],
                mode="subscription",
                success_url=request.build_absolute_uri(reverse("purchase:checkout_success")) + "?session_id={CHECKOUT_SESSION_ID}",
                cancel_url=request.build_absolute_uri(reverse("purchase:checkout_cancel")),
                metadata={"user_id": user.id},
            )
            return session
        except Exception as e:
            raise Exception(f"Stripe checkout session creation failed: {e}")
    
    @staticmethod
    def create_portal_session(customer_id, return_url):
        """顧客ポータルセッションを作成"""
        try:
            stripe.api_key = SubscriptionConstants.STRIPE_API_KEY
            portal_session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=return_url,
            )
            return portal_session
        except Exception as e:
            raise Exception(f"Stripe portal session creation failed: {e}")
    
    @staticmethod
    def construct_event(payload, api_key):
        """Stripeイベントを構築"""
        try:
            import json
            stripe.api_key = SubscriptionConstants.STRIPE_API_KEY
            event = stripe.Event.construct_from(
                json.loads(payload), api_key
            )
            return event
        except ValueError:
            raise ValueError("Invalid payload")
        except stripe.error.SignatureVerificationError:
            raise stripe.error.SignatureVerificationError("Invalid signature")


class EmailService:
    """メール送信のサービスクラス"""
    
    @staticmethod
    def send_payment_success_email(user):
        """支払い成功メールを送信"""
        subject = "支払い完了通知"
        message = (
            f"{user.username} さん\n\n"
            "Co-fittingのご利用ありがとうございます。\n\n"
            "申請いただいたサブスクリプションの支払いが完了しました。\n\n"
            "これからもCo-fittingをよろしくお願いいたします。\n\n"
        )
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
    
    @staticmethod
    def send_payment_failed_email(user, request):
        """支払い失敗メールを送信"""
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


class SubscriptionManager:
    """サブスクリプション管理のManagerクラス"""
    
    @staticmethod
    def handle_checkout_session_completed(event):
        """Checkoutセッション完了時の処理"""
        session = event.data.object
        customer_id = session.customer
        user_id = session.get("metadata", {}).get("user_id")
        
        try:
            user = User.objects.get(id=user_id)
            user.stripe_customer_id = customer_id
            user.save()
            return JsonResponse({"status": "success"})
        except User.DoesNotExist:
            return JsonResponse({"error": "User not found"}, status=404)
    
    @staticmethod
    def handle_subscription_change(event):
        """サブスクリプション状態変更時の処理"""
        session = event.data.object
        status = session.status
        
        try:
            user = User.objects.get(stripe_customer_id=session.customer)
            if status in SubscriptionConstants.INACTIVE_STATUSES:
                user.is_subscribed = False
                user.preset_limit = SubscriptionConstants.FREE_PRESET_LIMIT
                # ユーザーのレシピを1つだけ残して削除
                users_recipes = Recipe.objects.filter(create_user=user)
                if users_recipes.exists():
                    users_recipes.exclude(id=users_recipes.first().id).delete()
            user.save()
            return JsonResponse({"status": "success"})
        except User.DoesNotExist:
            return JsonResponse({"error": "User not found"}, status=404)
    
    @staticmethod
    def handle_invoice_paid(event):
        """支払い成功時の処理"""
        session = event.data.object
        customer_id = session.customer
        
        try:
            user = User.objects.get(stripe_customer_id=customer_id)
            user.preset_limit = SubscriptionConstants.PREMIUM_PRESET_LIMIT
            user.is_subscribed = True
            user.save()
            
            EmailService.send_payment_success_email(user)
            return JsonResponse({"status": "success"})
        except User.DoesNotExist:
            return JsonResponse({"error": "User not found"}, status=404)
    
    @staticmethod
    def handle_invoice_payment_failed(event, request):
        """支払い失敗時の処理"""
        session = event.data.object
        customer_id = session.customer
        
        try:
            user = User.objects.get(stripe_customer_id=customer_id)
            EmailService.send_payment_failed_email(user, request)
            return JsonResponse({"status": "success"})
        except User.DoesNotExist:
            return JsonResponse({"error": "User not found"}, status=404)

