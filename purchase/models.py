import stripe
import json
from django.urls import reverse
from users.models import User
from recipes.models import PresetRecipe
from Co_fitting.utils.response_helper import ResponseHelper
from Co_fitting.utils.constants import AppConstants
from Co_fitting.services.email_service import EmailService


class StripeService:
    """Stripe API処理のサービスクラス"""

    @staticmethod
    def create_checkout_session(user, request, plan_type=AppConstants.PLAN_BASIC):
        """チェックアウトセッションを作成"""
        try:
            stripe.api_key = AppConstants.STRIPE_API_KEY

            # プランタイプに応じたPrice IDを取得
            price_id = AppConstants.STRIPE_PRICE_IDS.get(plan_type)
            if not price_id:
                raise ValueError(f"Invalid plan type: {plan_type}")

            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[
                    {
                        "price": price_id,
                        "quantity": 1,
                    },
                ],
                mode="subscription",
                success_url=request.build_absolute_uri(reverse("purchase:checkout_success")) + "?session_id={CHECKOUT_SESSION_ID}",
                cancel_url=request.build_absolute_uri(reverse("purchase:checkout_cancel")),
                metadata={
                    "user_id": user.id,
                    "plan_type": plan_type,
                },
            )
            return session
        except Exception as e:
            raise Exception(f"Stripe checkout session creation failed: {e}")

    @staticmethod
    def change_subscription_plan(subscription_id, new_plan_type):
        """サブスクリプションのプランを変更"""
        try:
            stripe.api_key = AppConstants.STRIPE_API_KEY

            # 新しいプランのPrice IDを取得
            new_price_id = AppConstants.STRIPE_PRICE_IDS.get(new_plan_type)
            if not new_price_id:
                raise ValueError(f"Invalid plan type: {new_plan_type}")

            # サブスクリプション情報を取得
            subscription = stripe.Subscription.retrieve(subscription_id)

            # サブスクリプションアイテムを更新
            stripe.Subscription.modify(
                subscription_id,
                items=[{
                    'id': subscription['items']['data'][0].id,
                    'price': new_price_id,
                }],
                proration_behavior='always_invoice',  # 差額を即時請求
                metadata={'plan_type': new_plan_type},
            )
            return subscription
        except Exception as e:
            raise Exception(f"Stripe subscription plan change failed: {e}")

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
    def get_plan_type_from_price_id(price_id):
        """Price IDからプランタイプを判別"""
        for plan_type, plan_price_id in AppConstants.STRIPE_PRICE_IDS.items():
            if plan_price_id == price_id:
                return plan_type
        return None

    @staticmethod
    def construct_event(payload, api_key):
        """Stripeイベントを構築"""
        try:
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
        plan_type = session.get("metadata", {}).get("plan_type", AppConstants.PLAN_BASIC)

        try:
            user = User.objects.get(id=user_id)
            user.stripe_customer_id = customer_id
            user.plan_type = plan_type
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
            old_plan_type = user.plan_type

            if status in AppConstants.INACTIVE_STATUSES:
                # キャンセル・非アクティブの場合はFREEプランに降格
                new_plan_type = AppConstants.PLAN_FREE
            elif status in AppConstants.ACTIVE_STATUSES:
                # アクティブな場合、Price IDまたはメタデータからプランタイプを取得
                new_plan_type = subscription.get("metadata", {}).get("plan_type")
                if not new_plan_type:
                    # メタデータにない場合、Price IDから判別
                    price_id = subscription['items']['data'][0]['price']['id']
                    new_plan_type = StripeService.get_plan_type_from_price_id(price_id)
                if not new_plan_type:
                    # 判別できない場合はBASICとして扱う
                    new_plan_type = AppConstants.PLAN_BASIC
            else:
                # その他のステータスは変更なし
                return ResponseHelper.create_success_response("サブスクリプションステータスが更新されました。")

            # プランタイプを更新
            user.plan_type = new_plan_type
            user.save()

            # ダウングレード時のレシピ削除処理
            SubscriptionManager._handle_plan_downgrade_cleanup(user, old_plan_type, new_plan_type)

            return ResponseHelper.create_success_response("サブスクリプションが正常に処理されました。")
        except User.DoesNotExist:
            return ResponseHelper.create_not_found_error_response("ユーザーが見つかりません。")

    @staticmethod
    def _handle_plan_downgrade_cleanup(user, old_plan_type, new_plan_type):
        """プランダウングレード時の超過データ削除処理"""
        # 新旧プランの上限値を取得
        old_preset_limit = AppConstants.PRESET_LIMITS.get(old_plan_type, 1)
        new_preset_limit = AppConstants.PRESET_LIMITS.get(new_plan_type, 1)
        old_share_limit = AppConstants.SHARE_LIMITS.get(old_plan_type, 1)
        new_share_limit = AppConstants.SHARE_LIMITS.get(new_plan_type, 1)

        # ダウングレードでない場合は何もしない
        if new_preset_limit >= old_preset_limit and new_share_limit >= old_share_limit:
            return

        # プリセットレシピの超過分を削除（新しい順に削除、古いレシピを保持）
        user_presets = PresetRecipe.objects.filter(created_by=user).order_by('-id')
        preset_count = user_presets.count()
        if preset_count > new_preset_limit:
            # 超過分を削除（新しいものから、古いレシピを保持）
            delete_count = preset_count - new_preset_limit
            # スライシング後はdelete()できないので、IDを取得してから削除
            preset_ids_to_delete = list(user_presets[:delete_count].values_list('id', flat=True))
            PresetRecipe.objects.filter(id__in=preset_ids_to_delete).delete()

        # 共有レシピの超過分を削除（新しい順に削除、古いレシピを保持）
        from recipes.models import SharedRecipe
        user_shared = SharedRecipe.objects.filter(
            created_by=user
        ).order_by('-id')
        shared_count = user_shared.count()
        if shared_count > new_share_limit:
            # 超過分を削除（新しいものから、古いレシピを保持）
            delete_count = shared_count - new_share_limit
            # スライシング後はdelete()できないので、IDを取得してから削除
            shared_ids_to_delete = list(user_shared[:delete_count].values_list('id', flat=True))
            SharedRecipe.objects.filter(id__in=shared_ids_to_delete).delete()

    @staticmethod
    def handle_invoice_paid(event):
        """支払い成功時の処理"""
        invoice = event.data.object
        customer_id = invoice.customer

        try:
            user = User.objects.get(stripe_customer_id=customer_id)

            # サブスクリプション情報から現在のプランを取得
            if invoice.get('subscription'):
                stripe.api_key = AppConstants.STRIPE_API_KEY
                subscription = stripe.Subscription.retrieve(invoice['subscription'])

                # メタデータまたはPrice IDからプランタイプを取得
                plan_type = subscription.get("metadata", {}).get("plan_type")
                if not plan_type:
                    price_id = subscription['items']['data'][0]['price']['id']
                    plan_type = StripeService.get_plan_type_from_price_id(price_id)
                if not plan_type:
                    plan_type = AppConstants.PLAN_BASIC

                user.plan_type = plan_type
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
