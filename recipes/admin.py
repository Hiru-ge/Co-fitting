from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from users.models import User
from recipes.models import PresetRecipe, PresetRecipeStep, SharedRecipe, SharedRecipeStep


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


class RecipeStepInline(admin.TabularInline):  # PresetRecipeStepをPresetRecipeの詳細ページにインラインで表示するための設定
    model = PresetRecipeStep
    extra = 1  # 新しいPresetRecipeStepを追加するための空白フォームの数
    fields = ('step_number', 'total_water_ml_this_step', 'minute', 'seconds')


@admin.register(PresetRecipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ('name', 'id', 'is_ice', 'len_steps', 'bean_g', 'water_ml', 'memo')
    list_filter = ('is_ice',)  # アイスかどうかでフィルタリングできるようにする
    search_fields = ('name',)  # レシピ名で検索可能にする

    # PresetRecipeの詳細ページにPresetRecipeStepをインラインで表示
    inlines = [RecipeStepInline]


class SharedRecipeStepInline(admin.TabularInline):
    model = SharedRecipeStep
    extra = 1
    fields = ('step_number', 'total_water_ml_this_step', 'minute', 'seconds')


@admin.register(SharedRecipe)
class SharedRecipeAdmin(admin.ModelAdmin):
    list_display = ('name', 'id', 'created_by', 'is_ice', 'len_steps', 'bean_g', 'water_ml', 'access_token')
    list_filter = ('is_ice',)
    search_fields = ('name', 'access_token')
    inlines = [SharedRecipeStepInline]
