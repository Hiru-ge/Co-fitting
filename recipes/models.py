from django.db import models
from users.models import User


class Recipe(models.Model):
    name = models.CharField(max_length=30)
    create_user = models.ForeignKey(User, on_delete=models.CASCADE)
    is_ice = models.BooleanField(default=False)
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
    water_ml_this_step = models.FloatField()

    class Meta:
        ordering = ['step_number']  # 手順の順番で並べる

    def __str__(self):
        return f"Step {self.step_number} for {self.recipe_id.name}"
