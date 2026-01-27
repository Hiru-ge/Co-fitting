from django import forms
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from .models import User
from django_recaptcha.fields import ReCaptchaField
from django_recaptcha.widgets import ReCaptchaV2Checkbox
import re


class LoginForm(AuthenticationForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.widget.attrs["class"] = "form-control"


class SignUpForm(UserCreationForm):
    email = forms.EmailField(
        required=True,
        widget=forms.EmailInput(attrs={"class": "form-control"})
    )
    captcha = ReCaptchaField(widget=ReCaptchaV2Checkbox(
        attrs={
            'data-theme': 'dark',
        }
    ))

    class Meta:
        model = User
        fields = ("username", "email", "password1", "password2", "captcha")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field_name, field in self.fields.items():
            # captchaフィールドはg-recaptchaクラスが必要なのでスキップ
            if field_name == 'captcha':
                continue
            if hasattr(field, 'widget') and hasattr(field.widget, 'attrs'):
                field.widget.attrs["class"] = "form-control"

    # 自動で埋めたいカラムの処理
    def save(self, commit=True):
        user = super().save(commit=False)
        # plan_typeはUserManagerのcreate_userメソッドで自動的にFREEに設定される
        # preset_limitはplan_typeに基づいて自動計算されるプロパティなので設定不要
        if commit:
            user.save()
        return user

    def clean_username(self):
        username = self.cleaned_data.get('username')
        if username:
            # ユーザー名の長さチェック
            if len(username) < 3:
                raise forms.ValidationError("ユーザー名は3文字以上で入力してください。")
            if len(username) > 20:
                raise forms.ValidationError("ユーザー名は20文字以下で入力してください。")

            # ユーザー名の文字制限（英数字とアンダースコアのみ）
            if not re.match(r'^[a-zA-Z0-9_]+$', username):
                raise forms.ValidationError("ユーザー名は英数字とアンダースコアのみ使用できます。")
        return username

    def clean_email(self):
        email = self.cleaned_data.get('email')
        if email:
            # メールアドレスの重複チェック
            if User.objects.filter(email=email).exists():
                raise forms.ValidationError("入力内容を確認してください。")
        return email

    def clean_password1(self):
        password1 = self.cleaned_data.get('password1')
        if password1:
            # パスワードの長さチェック
            if len(password1) < 8:
                raise forms.ValidationError("パスワードは8文字以上で入力してください。")

            # パスワードの複雑さチェック
            if not re.search(r'[A-Za-z]', password1):
                raise forms.ValidationError("パスワードには英字を含めてください。")
            if not re.search(r'[0-9]', password1):
                raise forms.ValidationError("パスワードには数字を含めてください。")
        return password1


class EmailChangeForm(forms.Form):
    email = forms.EmailField(
        label='新しいメールアドレス',
        max_length=255,
        widget=forms.EmailInput(attrs={"class": "form-control"})
    )

    def clean_email(self):
        email = self.cleaned_data["email"]
        if email:
            # メールアドレスの重複チェック
            if User.objects.filter(email=email).exists():
                raise forms.ValidationError("このメールアドレスは既に使用されています")
        return email


class PasswordChangeForm(forms.Form):
    """パスワード変更フォーム"""
    old_password = forms.CharField(
        label='現在のパスワード',
        widget=forms.PasswordInput(attrs={"class": "form-control"})
    )
    new_password1 = forms.CharField(
        label='新しいパスワード',
        widget=forms.PasswordInput(attrs={"class": "form-control"})
    )
    new_password2 = forms.CharField(
        label='新しいパスワード（確認）',
        widget=forms.PasswordInput(attrs={"class": "form-control"})
    )

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super().__init__(*args, **kwargs)

    def clean_old_password(self):
        old_password = self.cleaned_data.get('old_password')
        if old_password:
            if not self.user.check_password(old_password):
                raise forms.ValidationError("現在のパスワードが正しくありません。")
        return old_password

    def clean_new_password1(self):
        new_password1 = self.cleaned_data.get('new_password1')
        if new_password1:
            # パスワードの長さチェック
            if len(new_password1) < 8:
                raise forms.ValidationError("パスワードは8文字以上で入力してください。")

            # パスワードの複雑さチェック
            if not re.search(r'[A-Za-z]', new_password1):
                raise forms.ValidationError("パスワードには英字を含めてください。")
            if not re.search(r'[0-9]', new_password1):
                raise forms.ValidationError("パスワードには数字を含めてください。")
        return new_password1

    def clean_new_password2(self):
        new_password1 = self.cleaned_data.get('new_password1')
        new_password2 = self.cleaned_data.get('new_password2')
        if new_password1 and new_password2:
            if new_password1 != new_password2:
                raise forms.ValidationError("新しいパスワードが一致しません。")
        return new_password2

    def clean(self):
        cleaned_data = super().clean()
        old_password = cleaned_data.get('old_password')
        new_password1 = cleaned_data.get('new_password1')

        # 現在のパスワードと新しいパスワードが同じでないかチェック
        if old_password and new_password1:
            if old_password == new_password1:
                raise forms.ValidationError("新しいパスワードは現在のパスワードと異なるものを入力してください。")

        return cleaned_data
