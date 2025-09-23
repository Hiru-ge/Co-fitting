from django.db import models
from users.models import User


class Recipe(models.Model):
    name = models.CharField(max_length=30)
    create_user = models.ForeignKey(User, on_delete=models.CASCADE)
    is_ice = models.BooleanField(default=False)
    ice_g = models.FloatField(blank=True, null=True)
    len_steps = models.IntegerField()
    bean_g = models.FloatField()
    water_ml = models.FloatField()
    memo = models.TextField(blank=True, null=True, max_length=300)

    def __str__(self):
        return self.name
    
    def to_dict(self):
        """レシピを辞書形式に変換するメソッド"""
        steps = RecipeStep.objects.filter(recipe_id=self).order_by('step_number')
        steps_data = [{'step_number': step.step_number, 'minute': step.minute, 'seconds': step.seconds, 'total_water_ml_this_step': step.total_water_ml_this_step} for step in steps]
        return {
            'id': self.id,
            'name': self.name,
            'is_ice': self.is_ice,
            'len_steps': self.len_steps,
            'bean_g': self.bean_g,
            'water_ml': self.water_ml,
            'ice_g': self.ice_g,
            'memo': self.memo,
            'steps': steps_data
        }


class RecipeStep(models.Model):
    recipe_id = models.ForeignKey(to=Recipe, on_delete=models.CASCADE, related_name='steps')
    step_number = models.IntegerField()
    minute = models.IntegerField()
    seconds = models.IntegerField()
    total_water_ml_this_step = models.FloatField()

    class Meta:
        ordering = ['step_number']  # 手順の順番で並べる

    def __str__(self):
        return f"Step {self.step_number} for {self.recipe_id.name}"


class SharedRecipe(models.Model):
    name = models.CharField(max_length=30)
    shared_by_user = models.ForeignKey(User, on_delete=models.CASCADE, null=False)
    is_ice = models.BooleanField(default=False)
    ice_g = models.FloatField(blank=True, null=True)
    len_steps = models.IntegerField()
    bean_g = models.FloatField()
    water_ml = models.FloatField()
    memo = models.TextField(blank=True, null=True, max_length=300)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    access_token = models.CharField(max_length=32, unique=True)

    def __str__(self):
        return f"Shared: {self.name} ({self.access_token})"
    
    def to_dict(self):
        """共有レシピを辞書形式に変換するメソッド"""
        steps = SharedRecipeStep.objects.filter(shared_recipe=self).order_by('step_number')
        steps_data = [{'step_number': step.step_number, 'minute': step.minute, 'seconds': step.seconds, 'total_water_ml_this_step': step.total_water_ml_this_step} for step in steps]
        return {
            'name': self.name,
            'shared_by_user': self.shared_by_user.username,
            'is_ice': self.is_ice,
            'ice_g': self.ice_g,
            'len_steps': self.len_steps,
            'bean_g': self.bean_g,
            'water_ml': self.water_ml,
            'memo': self.memo,
            'created_at': self.created_at,
            'expires_at': self.expires_at,
            'access_token': self.access_token,
            'steps': steps_data
        }


class SharedRecipeStep(models.Model):
    shared_recipe = models.ForeignKey(to=SharedRecipe, on_delete=models.CASCADE, related_name='steps')
    step_number = models.IntegerField()
    minute = models.IntegerField()
    seconds = models.IntegerField()
    total_water_ml_this_step = models.FloatField()

    class Meta:
        ordering = ['step_number']

    def __str__(self):
        return f"SharedStep {self.step_number} for {self.shared_recipe.name}"
