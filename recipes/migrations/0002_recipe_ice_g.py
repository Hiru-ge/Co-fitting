# Generated by Django 5.1.6 on 2025-02-15 07:59

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('recipes', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='recipe',
            name='ice_g',
            field=models.FloatField(blank=True, null=True),
        ),
    ]
