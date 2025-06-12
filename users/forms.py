from django import forms
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from .models import User
from django_recaptcha.fields import ReCaptchaField
from django_recaptcha.widgets import ReCaptchaV2Checkbox


class LoginForm(AuthenticationForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.widget.attrs["class"] = "form-control"


class SignUpForm(UserCreationForm):
    email = forms.EmailField(required=True)
    captcha = ReCaptchaField(widget=ReCaptchaV2Checkbox(
         attrs={
             'data-theme': 'dark',
         }
     ))

    class Meta:
        model = User
        fields = ("username", "email", "password1", "password2", "captcha")

    # 自動で埋めたいカラムの処理
    def save(self, commit=True):
        user = super().save(commit=False)
        user.preset_limit = 1   # 新規ユーザーのデフォルトプリセット数は1
        if commit:
            user.save()
        return user

    def clean_email(self):
        email = self.cleaned_data.get('email')
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError("入力内容を確認してください。")
        return email


class EmailChangeForm(forms.Form):
    email = forms.EmailField(
        label='新しいメールアドレス',
        max_length=255,
        widget=forms.EmailInput(attrs={"class": "form-control"})
    )

    def clean_email(self):
        email = self.cleaned_data["email"]
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError("このメールアドレスは既に使用されています")
        return email
