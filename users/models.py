from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    email = models.EmailField(unique=True)
    preset_limit = models.IntegerField(default=1)

    class Meta:
        db_table = "User"   # テーブル名

    def __str__(self):
        return self.username
