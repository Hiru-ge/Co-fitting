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
