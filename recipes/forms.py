from django import forms
from .models import Recipe, RecipeStep


class RecipeForm(forms.ModelForm):
    class Meta:
        model = Recipe
        fields = ['name', 'is_ice', 'ice_g', 'len_steps', 'bean_g', 'memo']


class RecipeStepForm(forms.ModelForm):
    class Meta:
        model = RecipeStep
        fields = ['minute', 'seconds', 'total_water_ml_this_step']
