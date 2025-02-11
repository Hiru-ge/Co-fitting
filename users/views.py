from django.shortcuts import render, redirect
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from .forms import SignUpForm, EmailChangeForm
from django.contrib.auth.views import LoginView
from django.contrib import messages
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.template.loader import render_to_string
from django.contrib.auth.tokens import default_token_generator
from django.urls import reverse, reverse_lazy
from .models import User
from django.utils.http import urlsafe_base64_decode


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
            confirmation_link = request.build_absolute_uri(
                reverse("users:signup_confirm", kwargs={"uidb64": uid, "token": token, "email": email})
            )

            # メール送信
            mail_subject = "サインアップ確認"
            message = render_to_string("users/signup_email.html", {
                "user": user,
                "confirmation_link": confirmation_link,
            })
            send_mail(mail_subject, message, "no-reply@example.com", [email])

            messages.success(request, "確認メールを送信しました。登録メールアドレスの受信ボックスを確認してください。")
            return redirect("mypage")
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
        return redirect("mypage")
    else:
        messages.error(request, "無効なリンクです。")
        return redirect("users:signup_request")


class CustomLoginView(LoginView):
    # エラーメッセージの出し方を少し変更
    # 「このメールアドレスは使用済みです」だと、攻撃者からメールが使用可能であることが一目で分かりやすいので避けたい
    def form_invalid(self, form):
        messages.error(self.request, "メールアドレスまたはパスワードが正しくありません。")
        return super().form_invalid(form)


@login_required
def change_email_request(request):
    """メールアドレス変更リクエスト（確認メール送信）"""
    if request.method == "POST":
        form = EmailChangeForm(request.POST)
        if form.is_valid():
            new_email = form.cleaned_data["email"]
            user = request.user

            # 認証用のトークンを生成
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            confirmation_link = request.build_absolute_uri(
                reverse("users:change_email_confirm", kwargs={"uidb64": uid, "token": token, "email": new_email})
            )

            # メール送信
            mail_subject = "メールアドレス変更確認"
            message = render_to_string("users/change_email_email.html", {
                "user": user,
                "confirmation_link": confirmation_link,
            })
            send_mail(mail_subject, message, "no-reply@example.com", [new_email])

            messages.success(request, "確認メールを送信しました。新しいメールアドレスの受信ボックスを確認してください。")
            return redirect("mypage")
    else:
        form = EmailChangeForm()

    return render(request, "users/change_email_request.html", {"form": form})


@login_required
def change_email_confirm(request, uidb64, token, email):
    """メールアドレス変更の確認（リンクをクリック）"""
    try:
        uid = urlsafe_base64_decode(uidb64).decode()
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    if user is not None and default_token_generator.check_token(user, token):
        user.email = email
        user.save()
        messages.success(request, "メールアドレスを変更しました。")
        return redirect("mypage")
    else:
        messages.error(request, "無効なリンクです。")
        return redirect("users:change_email_request")


@login_required
def account_delete(request):
    if request.method == 'POST':
        user = request.user
        user.is_active = False  # 物理削除ではなく、論理削除
        user.save()
        logout(request)

        return redirect(reverse_lazy('index'))  # 退会後トップページへリダイレクト
    else:

        return render(request, "users/account_delete.html")
