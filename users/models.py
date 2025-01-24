from django.contrib.auth.models import AbstractUser
from django.db import models


class CustomUser(AbstractUser):
    preset_limit = models.IntegerField(default=1)

    def __str__(self):
        return self.username
