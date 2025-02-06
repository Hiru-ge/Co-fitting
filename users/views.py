from django.shortcuts import render, redirect
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from .forms import SignUpForm, EmailChangeForm
from django.contrib.auth.views import LoginView
from django.contrib import messages


def signup(request):
    if request.method == "POST":
        form = SignUpForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.save()
            login(request, user)
            return redirect("mypage")
    else:
        form = SignUpForm()

    return render(request, "users/signup.html", {"form": form})


class CustomLoginView(LoginView):
    # エラーメッセージの出し方を少し変更
    # 「このメールアドレスは使用済みです」だと、攻撃者からメールが使用可能であることが一目で分かりやすいので避けたい
    def form_invalid(self, form):
        messages.error(self.request, "メールアドレスまたはパスワードが正しくありません。")
        return super().form_invalid(form)


@login_required
def change_email(request):
    if request.method == "POST":
        form = EmailChangeForm(request.POST)
        if form.is_valid():
            new_email = form.cleaned_data["email"]
            request.user.email = new_email
            request.user.save()
            messages.success(request, "メールアドレスを更新しました。")
            return redirect("mypage")
        else:
            messages.error(request, "入力に誤りがあります。")
    else:
        form = EmailChangeForm()

    return render(request, "users/change_email.html", {"form": form})
