from django.db import models
from users.models import User
from django.utils.crypto import get_random_string
from django.utils import timezone
from datetime import timedelta


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
    shared_by_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    is_ice = models.BooleanField(default=False)
    ice_g = models.FloatField(null=True, blank=True)
    len_steps = models.IntegerField()
    bean_g = models.FloatField()
    water_ml = models.FloatField()
    memo = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True)
    access_token = models.CharField(max_length=255, unique=True)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.access_token:
            self.access_token = get_random_string(32)
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(days=30)
        super().save(*args, **kwargs)


class SharedRecipeStep(models.Model):
    shared_recipe = models.ForeignKey(SharedRecipe, on_delete=models.CASCADE)
    step_number = models.IntegerField()
    minute = models.IntegerField()
    seconds = models.IntegerField()
    total_water_ml_this_step = models.FloatField()

    def __str__(self):
        return f"{self.shared_recipe.name} - Step {self.step_number}"
