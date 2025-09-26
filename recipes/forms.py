from django import forms
from django.core.exceptions import ValidationError
from .models import PresetRecipe, PresetRecipeStep, ShareConstants


class RecipeForm(forms.ModelForm):
    class Meta:
        model = PresetRecipe
        fields = ['name', 'is_ice', 'ice_g', 'len_steps', 'bean_g', 'memo']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control', 'maxlength': '30'}),
            'is_ice': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'ice_g': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.1', 'min': '0'}),
            'len_steps': forms.NumberInput(attrs={'class': 'form-control', 'min': '1', 'max': '20'}),
            'bean_g': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.1', 'min': '0'}),
            'memo': forms.Textarea(attrs={'class': 'form-control', 'rows': '3', 'maxlength': '300'}),
        }
    
    def clean_name(self):
        name = self.cleaned_data.get('name')
        if not name or len(name.strip()) == 0:
            raise ValidationError('レシピ名を入力してください。')
        if len(name) > 30:
            raise ValidationError('レシピ名は30文字以内で入力してください。')
        return name.strip()
    
    def clean_len_steps(self):
        len_steps = self.cleaned_data.get('len_steps')
        if len_steps is None or len_steps < 1:
            raise ValidationError('ステップ数は1以上で入力してください。')
        if len_steps > 20:
            raise ValidationError('ステップ数は20以下で入力してください。')
        return len_steps
    
    def clean_bean_g(self):
        bean_g = self.cleaned_data.get('bean_g')
        if bean_g is None or bean_g <= 0:
            raise ValidationError('豆量は0より大きい値を入力してください。')
        if bean_g > 1000:
            raise ValidationError('豆量は1000g以下で入力してください。')
        return bean_g
    
    def clean_ice_g(self):
        is_ice = self.cleaned_data.get('is_ice')
        ice_g = self.cleaned_data.get('ice_g')
        
        if is_ice:
            if ice_g is None or ice_g <= 0:
                raise ValidationError('アイスコーヒーの場合は氷量を入力してください。')
            if ice_g > 1000:
                raise ValidationError('氷量は1000g以下で入力してください。')
        else:
            ice_g = None
        
        return ice_g
    
    def clean_memo(self):
        memo = self.cleaned_data.get('memo')
        if memo and len(memo) > 300:
            raise ValidationError('メモは300文字以内で入力してください。')
        return memo


class RecipeStepForm(forms.ModelForm):
    class Meta:
        model = PresetRecipeStep
        fields = ['minute', 'seconds', 'total_water_ml_this_step']
        widgets = {
            'minute': forms.NumberInput(attrs={'class': 'form-control', 'min': '0', 'max': '59'}),
            'seconds': forms.NumberInput(attrs={'class': 'form-control', 'min': '0', 'max': '59'}),
            'total_water_ml_this_step': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.1', 'min': '0'}),
        }
    
    def clean_minute(self):
        minute = self.cleaned_data.get('minute')
        if minute is None or minute < 0:
            raise ValidationError('分は0以上で入力してください。')
        if minute > 59:
            raise ValidationError('分は59以下で入力してください。')
        return minute
    
    def clean_seconds(self):
        seconds = self.cleaned_data.get('seconds')
        if seconds is None or seconds < 0:
            raise ValidationError('秒は0以上で入力してください。')
        if seconds > 59:
            raise ValidationError('秒は59以下で入力してください。')
        return seconds
    
    def clean_total_water_ml_this_step(self):
        water_ml = self.cleaned_data.get('total_water_ml_this_step')
        if water_ml is None or water_ml < 0:
            raise ValidationError('注湯量は0以上で入力してください。')
        if water_ml > 1000:
            raise ValidationError('注湯量は1000ml以下で入力してください。')
        return water_ml


class SharedRecipeDataForm(forms.Form):
    """共有レシピデータ検証用のフォーム"""
    
    name = forms.CharField(max_length=30, required=True)
    bean_g = forms.DecimalField(max_digits=5, decimal_places=1, min_value=0.1, max_value=1000, required=True)
    water_ml = forms.DecimalField(max_digits=5, decimal_places=1, min_value=0, max_value=1000, required=True)
    is_ice = forms.BooleanField(required=False)
    ice_g = forms.DecimalField(max_digits=5, decimal_places=1, min_value=0, max_value=1000, required=False)
    len_steps = forms.IntegerField(min_value=1, max_value=20, required=True)
    steps = forms.JSONField(required=True)
    
    def clean_name(self):
        name = self.cleaned_data.get('name')
        if not name or len(name.strip()) == 0:
            raise ValidationError('レシピ名を入力してください。')
        return name.strip()
    
    def clean_ice_g(self):
        is_ice = self.cleaned_data.get('is_ice')
        ice_g = self.cleaned_data.get('ice_g')
        
        if is_ice and (ice_g is None or ice_g <= 0):
            raise ValidationError('アイスコーヒーの場合は氷量を入力してください。')
        
        return ice_g
    
    def clean_steps(self):
        steps = self.cleaned_data.get('steps')
        len_steps = self.cleaned_data.get('len_steps')
        
        if not isinstance(steps, list):
            raise ValidationError('ステップデータは配列である必要があります。')
        
        if len(steps) != len_steps:
            raise ValidationError('ステップ数が一致しません。')
        
        # 各ステップの詳細な検証
        for i, step in enumerate(steps):
            if not isinstance(step, dict):
                raise ValidationError(f'ステップ{i+1}のデータ形式が正しくありません。')
            
            required_fields = ['minute', 'seconds', 'total_water_ml_this_step']
            for field in required_fields:
                if field not in step:
                    raise ValidationError(f'ステップ{i+1}に{field}がありません。')
            
            # 分の範囲チェック
            minute = step.get('minute')
            if minute is None or minute < 0 or minute > 59:
                raise ValidationError(f'ステップ{i+1}の分は0-59の範囲で入力してください。')
            
            # 秒の範囲チェック
            seconds = step.get('seconds')
            if seconds is None or seconds < 0 or seconds > 59:
                raise ValidationError(f'ステップ{i+1}の秒は0-59の範囲で入力してください。')
            
            # 注湯量の範囲チェック
            water_ml = step.get('total_water_ml_this_step')
            if water_ml is None or water_ml < 0:
                raise ValidationError(f'ステップ{i+1}の注湯量は0以上で入力してください。')
            if water_ml > 1000:
                raise ValidationError(f'ステップ{i+1}の注湯量は1000ml以下で入力してください。')
        
        return steps
