from django.shortcuts import render, redirect
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from .forms import SignUpForm, EmailChangeForm
from django.contrib.auth.views import LoginView
from django.contrib import messages
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import default_token_generator
from django.urls import reverse, reverse_lazy
from .models import User
from django.utils import timezone
import threading
from django.conf import settings


def signup_request(request):
    """サインアップリクエスト（確認メール送信）"""
    if request.method == "POST":
        form = SignUpForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.is_active = False
            form.save()

            # 認証用のトークンを生成
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            email = user.email
            encoded_email = urlsafe_base64_encode(force_bytes(email))
            confirmation_link = request.build_absolute_uri(
                reverse("users:signup_confirm", kwargs={"uidb64": uid, "token": token, "email": encoded_email})
            )

            # メール送信
            mail_subject = "サインアップ確認"
            message = (
                f"{user.username} さん\n\n"
                "ユーザー登録の確認です。\n\n"
                "以下のリンクをクリックして、ユーザー登録を完了してください。\n\n"
                f"{confirmation_link}\n\n"
                "このリンクは一度しか使用できませんのでご注意ください。"
            )
            send_mail(mail_subject, message, "no-reply@example.com", [user.email])

            messages.success(request, "確認メールを送信しました。登録メールアドレスの受信ボックスを確認してください。メールが届かない場合は、迷惑メールフォルダを確認してみてください。")
            return redirect("recipes:mypage")
    else:
        form = SignUpForm()

    return render(request, "users/signup_request.html", {"form": form})


def signup_confirm(request, uidb64, token, email):
    """サインアップの確認（リンクをクリック）"""
    try:
        uid = urlsafe_base64_decode(uidb64).decode()
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    if user is not None and default_token_generator.check_token(user, token):
        user.is_active = True
        user.save()
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

        # IPアドレスを取得
        ip_address = self.get_client_ip()

        # メール送信（非同期で実行）
        threading.Thread(target=self.send_login_email, args=(user, ip_address)).start()

        return response

    def get_client_ip(self):
        """リクエストのIPアドレスを取得"""
        x_forwarded_for = self.request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0]
        else:
            ip = self.request.META.get("REMOTE_ADDR")
        return ip

    def send_login_email(self, user, ip_address):
        """ログイン通知メールを送信"""
        subject = "ログイン通知"
        message = (
            f"{user.username} さん\n\n"
            "Co-fittingにて、あなたのアカウントでログインがありました。\n"
            f"日時: {timezone.localtime()}\n"
            f"IPアドレス: {ip_address}\n\n"
            "もしこのログインに心当たりがない場合は、至急パスワードを変更してください。"
        )
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])


@login_required
def email_change_request(request):
    """メールアドレス変更リクエスト（確認メール送信）"""
    if request.method == "POST":
        form = EmailChangeForm(request.POST)
        if form.is_valid():
            new_email = form.cleaned_data["email"]
            user = request.user

            # 認証用のトークンを生成
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            encoded_new_email = urlsafe_base64_encode(force_bytes(new_email))
            confirmation_link = request.build_absolute_uri(
                reverse("users:email_change_confirm", kwargs={"uidb64": uid, "token": token, "email": encoded_new_email})
            )

            # メール送信
            mail_subject = "メールアドレス変更確認"
            message = (
                f"{user.username} さん\n\n"
                "メールアドレス変更の確認です。\n\n"
                "以下のリンクをクリックして、メールアドレスの変更を完了してください。\n\n"
                f"{confirmation_link}\n\n"
                "このリンクは一度しか使用できませんのでご注意ください。"
            )
            send_mail(mail_subject, message, "no-reply@example.com", [new_email])

            messages.success(request, "確認メールを送信しました。新しいメールアドレスの受信ボックスを確認してください。")
            return redirect("recipes:mypage")
    else:
        form = EmailChangeForm()

    return render(request, "users/email_change_request.html", {"form": form})


@login_required
def email_change_confirm(request, uidb64, token, email):
    """メールアドレス変更の確認（リンクをクリック）"""
    try:
        uid = urlsafe_base64_decode(uidb64).decode()
        user = User.objects.get(pk=uid)
        decoded_email = force_str(urlsafe_base64_decode(email))
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None
        decoded_email = None

    if user is not None and default_token_generator.check_token(user, token):
        user.email = decoded_email
        user.save()
        messages.success(request, "メールアドレスを変更しました。")
        return redirect("recipes:mypage")
    else:
        messages.error(request, "無効なリンクです。")
        return redirect("users:email_change_request")


@login_required
def account_delete(request):
    if request.method == 'POST':
        user = request.user
        user.is_active = False  # 物理削除ではなく、論理削除
        user.deactivated_at = timezone.now()  # 退会日時を記録(30日経ったら物理削除するための記録用)
        user.save()
        logout(request)

        return redirect(reverse_lazy('index'))  # 退会後トップページへリダイレクト
    else:

        return render(request, "users/account_delete.html")
