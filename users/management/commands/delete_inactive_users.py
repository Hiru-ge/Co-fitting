from django.core.management.base import BaseCommand
from django.utils import timezone
from users.models import User
from datetime import timedelta


class Command(BaseCommand):
    """
    退会から30日たった非アクティブユーザーをDBから削除する
    """
    def handle(self, *args, **kwargs):
        threshold_date = timezone.now() - timedelta(days=30)
        users_to_delete = User.objects.filter(is_active=False, deactivated_at__lte=threshold_date)
        count = users_to_delete.count()
        users_to_delete.delete()
        self.stdout.write(self.style.SUCCESS(f'Successfully deleted {count} users'))
