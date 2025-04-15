from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from users.models import User
from recipes.models import Recipe, RecipeStep


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'is_subscribed', 'email', 'is_staff', 'preset_limit')

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {'fields': ('username', 'is_subscribed', 'stripe_customer_id')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser')}),
        ('Custom Fields', {'fields': ('preset_limit',)}),
    )

    # 管理画面からユーザー追加を行う際のフォーム設定
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'username', 'password1', 'password2', 'preset_limit'),
        }),
    )

    search_fields = ('email', 'username')


class RecipeStepInline(admin.TabularInline):  # RecipeStepをRecipeの詳細ページにインラインで表示するための設定
    model = RecipeStep
    extra = 1  # 新しいRecipeStepを追加するための空白フォームの数
    fields = ('step_number', 'total_water_ml_this_step', 'minute', 'seconds')


@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ('name', 'id', 'is_ice', 'len_steps', 'bean_g', 'water_ml', 'memo')
    list_filter = ('is_ice',)  # アイスかどうかでフィルタリングできるようにする
    search_fields = ('name',)  # レシピ名で検索可能にする

    # Recipeの詳細ページにRecipeStepをインラインで表示
    inlines = [RecipeStepInline]
