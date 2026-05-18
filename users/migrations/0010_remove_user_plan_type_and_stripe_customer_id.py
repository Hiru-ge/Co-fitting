from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0009_remove_user_is_subscribed_remove_user_preset_limit_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='user',
            name='plan_type',
        ),
        migrations.RemoveField(
            model_name='user',
            name='stripe_customer_id',
        ),
    ]
