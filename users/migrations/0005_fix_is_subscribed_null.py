# Generated manually for refactoring

from django.db import migrations


def fix_is_subscribed_null(apps, schema_editor):
    """既存のnull値をFalseに変換"""
    User = apps.get_model('users', 'User')
    User.objects.filter(is_subscribed__isnull=True).update(is_subscribed=False)


def reverse_fix_is_subscribed_null(apps, schema_editor):
    """逆マイグレーションは不要（nullに戻す必要がない）"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_user_is_subscribed_user_stripe_customer_id'),
    ]

    operations = [
        migrations.RunPython(fix_is_subscribed_null, reverse_fix_is_subscribed_null),
    ]
