# Generated by Django 5.1.6 on 2025-02-24 08:39

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_alter_user_table'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='deactivated_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
