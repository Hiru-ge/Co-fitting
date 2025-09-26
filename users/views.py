from django.shortcuts import render, redirect
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from .forms import SignUpForm, EmailChangeForm, PasswordChangeForm
from django.contrib.auth.views import LoginView
from django.contrib import messages
from django.urls import reverse, reverse_lazy
from django.conf import settings
from .models import User
from Co_fitting.utils.security_utils import SecurityUtils
from Co_fitting.utils.response_helper import ResponseHelper


def signup_request(request):
    """サインアップリクエスト（確認メール送信）"""
    if request.method == "POST":
        form = SignUpForm(request.POST)
        if form.is_valid():
            User.objects.create_inactive_user_with_confirmation(form, request)
            messages.success(request, "確認メールを送信しました。登録メールアドレスの受信ボックスを確認してください。メールが届かない場合は、迷惑メールフォルダを確認してみてください。")
            return redirect("recipes:mypage")
    else:
        form = SignUpForm()

    return render(request, "users/signup_request.html", {"form": form})


def signup_confirm(request, uidb64, token, email):
    """サインアップの確認（リンクをクリック）"""
    user = SecurityUtils.verify_confirmation_tokens(uidb64, token)

    if user is not None:
        if user.is_active:
            messages.info(request, "アカウントは既に有効化されています。Outlook等から直接URLを踏んだ際にこのメッセージが表示される場合がありますが、基本的に問題ありません。通常通りログインいただけるはずです。")
        else:
            User.objects.activate_user(user)
            login(request, user)
            messages.success(request, "ユーザー登録が完了しました。")
        return redirect("recipes:mypage")
    else:
        messages.error(request, "無効なリンクです。")
        return redirect("users:signup_request")


class CustomLoginView(LoginView):
    # エラーメッセージの出し方を少し変更
    # 「このメールアドレスは使用済みです」だと、攻撃者からメールが使用可能であることが一目で分かりやすいので避けたい
    def form_invalid(self, form):
        messages.error(self.request, "メールアドレスまたはパスワードが正しくありません。")
        return super().form_invalid(form)

    def form_valid(self, form):
        """認証成功時にメール通知を送信"""
        response = super().form_valid(form)  # 既存の処理を実行
        user = self.request.user  # 認証されたユーザー

        # IPアドレスを取得してメール送信（非同期で実行）
        ip_address = User.objects.get_client_ip(self.request)
        User.objects.send_login_notification_async(user, ip_address)

        return response


@login_required
def email_change_request(request):
    """メールアドレス変更リクエスト（確認メール送信）"""
    if request.method == "POST":
        form = EmailChangeForm(request.POST)
        if form.is_valid():
            new_email = form.cleaned_data["email"]
            user = request.user

            # メールアドレス変更確認メールを送信
            User.objects.send_email_change_confirmation(user, new_email, request)

            messages.success(request, "確認メールを送信しました。新しいメールアドレスの受信ボックスを確認してください。")
            return redirect("recipes:mypage")
        else:
            # フォームエラーを返す
            return ResponseHelper.create_validation_error_response(form.errors)
    else:
        # GETリクエストの場合はマイページにリダイレクト
        return redirect("recipes:mypage")


@login_required
def email_change_confirm(request, uidb64, token, email):
    """メールアドレス変更の確認（リンクをクリック）"""
    user, decoded_email = SecurityUtils.verify_confirmation_tokens(uidb64, token, email)

    if user is not None and decoded_email is not None:
        User.objects.change_user_email(user, decoded_email)
        messages.success(request, "メールアドレスを変更しました。")
        return redirect("recipes:mypage")

    messages.error(request, "無効なリンクです。")
    return redirect("recipes:mypage")


@login_required
def password_change_api(request):
    """パスワード変更API（モーダル用）"""
    if request.method == 'POST':
        form = PasswordChangeForm(request.user, request.POST)
        if form.is_valid():
            new_password = form.cleaned_data['new_password1']
            # Model層でパスワード変更とログアウト処理を実行
            User.objects.change_user_password(request.user, new_password, request)
            return ResponseHelper.create_success_response(
                'パスワードを変更しました。セキュリティのため、ログアウトされました。新しいパスワードでログインしてください。',
                {'redirect_url': settings.LOGIN_URL}
            )
        else:
            # フォームエラーを返す
            return ResponseHelper.create_validation_error_response(form.errors)

    return ResponseHelper.create_error_response('invalid_request', '無効なリクエストです。')


def password_reset_done_redirect(request):
    """パスワードリセット送信完了時にマイページにリダイレクトしてモーダル表示"""
    return redirect(reverse('recipes:mypage') + '?password_reset_sent=true')


def password_reset_complete_redirect(request):
    """パスワードリセット完了時にマイページにリダイレクトしてモーダル表示"""
    return redirect(reverse('recipes:mypage') + '?password_reset_success=true')


@login_required
def account_delete(request):
    if request.method == 'POST':
        # 元の挙動を維持：POSTリクエストのみでアカウント削除
        user = request.user
        User.objects.deactivate_user(user)
        logout(request)
        return redirect(reverse_lazy('recipes:index'))  # 退会後トップページへリダイレクト
    else:
        return ResponseHelper.create_error_response('invalid_request', '無効なリクエストです。')
