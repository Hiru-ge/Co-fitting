from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from users.models import User
from recipes.models import Recipe, RecipeStep


@admin.register(User)
class UserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('Custom Fields', {'fields': ('preset_limit',)}),
    )
    list_display = ('username', 'email', 'is_staff', 'preset_limit')


class RecipeStepInline(admin.TabularInline):  # RecipeStepをRecipeの詳細ページにインラインで表示するための設定
    model = RecipeStep
    extra = 1  # 新しいRecipeStepを追加するための空白フォームの数
    fields = ('step_number', 'water_ml_this_step', 'minute', 'seconds')


@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ('name', 'id', 'is_ice', 'len_steps', 'bean_g', 'water_ml', 'memo')
    list_filter = ('is_ice',)  # アイスかどうかでフィルタリングできるようにする
    search_fields = ('name',)  # レシピ名で検索可能にする

    # Recipeの詳細ページにRecipeStepをインラインで表示
    inlines = [RecipeStepInline]
