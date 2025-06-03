from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from users.models import User
from recipes.models import Recipe, RecipeStep, SharedRecipe, SharedRecipeStep


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
    extra = 0


@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ('name', 'create_user', 'is_ice', 'bean_g', 'water_ml')
    list_filter = ('is_ice', 'create_user')
    search_fields = ('name',)
    inlines = [RecipeStepInline]


class SharedRecipeStepInline(admin.TabularInline):
    model = SharedRecipeStep
    extra = 0


@admin.register(SharedRecipe)
class SharedRecipeAdmin(admin.ModelAdmin):
    list_display = ('name', 'shared_by_user', 'is_ice', 'bean_g', 'water_ml', 'created_at', 'expires_at')
    list_filter = ('is_ice', 'shared_by_user', 'created_at')
    search_fields = ('name', 'access_token')
    inlines = [SharedRecipeStepInline]
