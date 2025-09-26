import stripe
from django.urls import reverse
from users.models import User
from recipes.models import PresetRecipe
from Co_fitting.utils.response_helper import ResponseHelper
from Co_fitting.utils.constants import AppConstants
from Co_fitting.services.email_service import EmailService


class StripeService:
    """Stripe API処理のサービスクラス"""

    @staticmethod
    def create_checkout_session(user, request):
        """チェックアウトセッションを作成"""
        try:
            stripe.api_key = AppConstants.STRIPE_API_KEY
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[
                    {
                        "price": AppConstants.STRIPE_PRICE_ID,
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
            stripe.api_key = AppConstants.STRIPE_API_KEY
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
            stripe.api_key = AppConstants.STRIPE_API_KEY
            event = stripe.Event.construct_from(
                json.loads(payload), api_key
            )
            return event
        except ValueError:
            raise ValueError("Invalid payload")
        except stripe.error.SignatureVerificationError:
            raise stripe.error.SignatureVerificationError("Invalid signature")


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
            # サブスクリプション状態を更新
            user.is_subscribed = True
            user.preset_limit = AppConstants.PREMIUM_PRESET_LIMIT
            user.save()

            # 成功メールを送信
            EmailService.send_payment_success_email(user)
            return ResponseHelper.create_success_response("サブスクリプションが正常に処理されました。")
        except User.DoesNotExist:
            return ResponseHelper.create_not_found_error_response("ユーザーが見つかりません。")

    @staticmethod
    def handle_subscription_change(event):
        """サブスクリプション状態変更時の処理"""
        subscription = event.data.object
        status = subscription.status

        try:
            user = User.objects.get(stripe_customer_id=subscription.customer)
            if status in AppConstants.INACTIVE_STATUSES:
                user.is_subscribed = False
                user.preset_limit = AppConstants.FREE_PRESET_LIMIT
                # ユーザーのレシピを1つだけ残して削除
                users_recipes = PresetRecipe.objects.filter(created_by=user)
                if users_recipes.exists():
                    users_recipes.exclude(id=users_recipes.first().id).delete()
            elif status in AppConstants.ACTIVE_STATUSES:
                user.is_subscribed = True
                user.preset_limit = AppConstants.PREMIUM_PRESET_LIMIT
            user.save()
            return ResponseHelper.create_success_response("サブスクリプションが正常に処理されました。")
        except User.DoesNotExist:
            return ResponseHelper.create_not_found_error_response("ユーザーが見つかりません。")

    @staticmethod
    def handle_invoice_paid(event):
        """支払い成功時の処理"""
        session = event.data.object
        customer_id = session.customer

        try:
            user = User.objects.get(stripe_customer_id=customer_id)
            user.preset_limit = AppConstants.PREMIUM_PRESET_LIMIT
            user.is_subscribed = True
            user.save()

            EmailService.send_payment_success_email(user)
            return ResponseHelper.create_success_response("サブスクリプションが正常に処理されました。")
        except User.DoesNotExist:
            return ResponseHelper.create_not_found_error_response("ユーザーが見つかりません。")

    @staticmethod
    def handle_invoice_payment_failed(event, request):
        """支払い失敗時の処理"""
        session = event.data.object
        customer_id = session.customer

        try:
            user = User.objects.get(stripe_customer_id=customer_id)
            EmailService.send_payment_failed_email(user, request)
            return ResponseHelper.create_success_response("サブスクリプションが正常に処理されました。")
        except User.DoesNotExist:
            return ResponseHelper.create_not_found_error_response("ユーザーが見つかりません。")
