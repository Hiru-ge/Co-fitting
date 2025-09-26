"""
テスト用の共通ヘルパー関数
DRY原則に従い、重複するテストコードを統一する
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
import uuid

User = get_user_model()


def create_test_user(username='testuser', email='test@example.com', password='securepassword123', is_active=True, is_subscribed=False, preset_limit=1):
    """
    テストユーザーを作成する共通関数
    
    Args:
        username (str): ユーザー名
        email (str): メールアドレス
        password (str): パスワード
        is_active (bool): アクティブ状態
        is_subscribed (bool): サブスクリプション状態
        preset_limit (int): プリセット制限数
    
    Returns:
        User: 作成されたユーザーオブジェクト
    """
    user = User.objects.create_user(
        username=username,
        email=email,
        password=password
    )
    user.is_active = is_active
    user.is_subscribed = is_subscribed
    user.preset_limit = preset_limit
    user.save()
    return user


def create_default_preset_user():
    """
    デフォルトプリセットユーザーを作成する
    
    Returns:
        User: デフォルトプリセットユーザー
    """
    return create_test_user(
        username='DefaultPreset',
        email='default@example.com',
        password='defaultpassword123'
    )


def create_test_recipe(user, name='テストレシピ', is_ice=False, len_steps=2, bean_g=20.0, water_ml=200.0, memo='テスト用メモ'):
    """
    テスト用レシピを作成する共通関数
    
    Args:
        user (User): レシピの作成者
        name (str): レシピ名
        is_ice (bool): アイスコーヒーかどうか
        len_steps (int): ステップ数
        bean_g (float): 豆の量
        water_ml (float): 湯量
        memo (str): メモ
    
    Returns:
        PresetRecipe: 作成されたレシピオブジェクト
    """
    from recipes.models import PresetRecipe, PresetRecipeStep
    
    recipe = PresetRecipe.objects.create(
        name=name,
        created_by=user,
        is_ice=is_ice,
        len_steps=len_steps,
        bean_g=bean_g,
        water_ml=water_ml,
        memo=memo
    )
    
    # ステップを作成
    for i in range(len_steps):
        PresetRecipeStep.objects.create(
            recipe=recipe,
            step_number=i + 1,
            minute=i,
            seconds=0,
            total_water_ml_this_step=water_ml / len_steps,
        )
    
    return recipe


def create_test_shared_recipe(user, name='テスト共有レシピ', is_ice=False, len_steps=2, bean_g=20.0, water_ml=200.0, memo='テスト用メモ'):
    """
    テスト用共有レシピを作成する共通関数
    
    Args:
        user (User): 共有レシピの作成者
        name (str): レシピ名
        is_ice (bool): アイスコーヒーかどうか
        len_steps (int): ステップ数
        bean_g (float): 豆の量
        water_ml (float): 湯量
        memo (str): メモ
    
    Returns:
        SharedRecipe: 作成された共有レシピオブジェクト
    """
    from recipes.models import SharedRecipe, SharedRecipeStep
    
    # ユニークなアクセストークンを生成
    unique_id = str(uuid.uuid4()).replace('-', '')[:8]
    access_token = f'test_token_{unique_id}_12345678901234567890123456789012'[:32]
    
    shared_recipe = SharedRecipe.objects.create(
        name=name,
        created_by=user,
        is_ice=is_ice,
        len_steps=len_steps,
        bean_g=bean_g,
        water_ml=water_ml,
        memo=memo,
        access_token=access_token
    )
    
    # ステップを作成
    for i in range(len_steps):
        SharedRecipeStep.objects.create(
            recipe=shared_recipe,
            step_number=i + 1,
            minute=i,
            seconds=0,
            total_water_ml_this_step=water_ml / len_steps,
        )
    
    return shared_recipe


def login_test_user(test_case, user=None, username='test@example.com', password='securepassword123'):
    """
    テストユーザーでログインする共通関数
    
    Args:
        test_case (TestCase): テストケースインスタンス
        user (User, optional): ログインするユーザー（指定された場合はそのユーザーのメールアドレスを使用）
        username (str): ログイン用のメールアドレス
        password (str): パスワード
    
    Returns:
        bool: ログイン成功かどうか
    """
    if user:
        username = user.email
        # ユーザーが指定された場合、パスワードが明示的に指定されていない場合は
        # デフォルトパスワードを使用（create_test_userのデフォルトパスワード）
        if password == 'securepassword123':
            password = 'securepassword123'  # create_test_userのデフォルトパスワード
    
    login_success = test_case.client.login(username=username, password=password)
    test_case.assertTrue(login_success, f"ログインに失敗しました: {username} (パスワード: {password})")
    return login_success


class BaseTestCase(TestCase):
    """
    テストケースの基底クラス
    共通のセットアップ処理を提供
    """
    
    def setUp(self):
        """共通のセットアップ処理"""
        super().setUp()
        # デフォルトプリセットユーザーを作成（多くのテストで必要）
        self.default_preset_user = create_default_preset_user()
    
    def create_and_login_user(self, username='testuser', email='test@example.com', **kwargs):
        """
        ユーザーを作成してログインする
        
        Args:
            username (str): ユーザー名
            email (str): メールアドレス
            **kwargs: create_test_userに渡す追加引数
        
        Returns:
            User: 作成されたユーザー
        """
        user = create_test_user(username=username, email=email, **kwargs)
        login_test_user(self, user=user)
        return user


def assert_json_response(test_case, response, expected_status=200, expected_keys=None, expected_data=None):
    """
    JSONレスポンスの検証を行う共通関数
    
    Args:
        test_case (TestCase): テストケースインスタンス
        response (HttpResponse): レスポンスオブジェクト
        expected_status (int): 期待するステータスコード
        expected_keys (list): 期待するキーのリスト
        expected_data (dict): 期待するデータ
    """
    test_case.assertEqual(response.status_code, expected_status)
    
    if response['Content-Type'] == 'application/json':
        import json
        response_data = json.loads(response.content)
        
        if expected_keys:
            for key in expected_keys:
                test_case.assertIn(key, response_data, f"レスポンスにキー '{key}' が含まれていません")
        
        if expected_data:
            for key, value in expected_data.items():
                test_case.assertEqual(response_data[key], value, f"キー '{key}' の値が期待値と異なります")


def create_recipe_data(name='テストレシピ', bean_g=20.0, water_ml=200.0, is_ice=False, len_steps=2):
    """
    レシピデータの辞書を作成する共通関数
    
    Args:
        name (str): レシピ名
        bean_g (float): 豆の量
        water_ml (float): 湯量
        is_ice (bool): アイスコーヒーかどうか
        len_steps (int): ステップ数
    
    Returns:
        dict: レシピデータ
    """
    steps = []
    for i in range(len_steps):
        steps.append({
            "step_number": i + 1,
            "minute": i,
            "seconds": 0,
            "total_water_ml_this_step": water_ml / len_steps
        })
    
    return {
        "name": name,
        "bean_g": bean_g,
        "water_ml": water_ml,
        "is_ice": is_ice,
        "len_steps": len_steps,
        "steps": steps
    }


def create_form_data(name='テストレシピ', len_steps=2, bean_g=20.0, is_ice=False, ice_g=None, memo='テスト用メモ'):
    """
    フォームデータの辞書を作成する共通関数
    
    Args:
        name (str): レシピ名
        len_steps (int): ステップ数
        bean_g (float): 豆の量
        is_ice (bool): アイスコーヒーかどうか
        ice_g (float): 氷の量
        memo (str): メモ
    
    Returns:
        dict: フォームデータ
    """
    form_data = {
        "name": name,
        "len_steps": len_steps,
        "bean_g": bean_g,
        "memo": memo
    }
    
    if is_ice:
        form_data["is_ice"] = "on"
        if ice_g:
            form_data["ice_g"] = ice_g
    
    # ステップデータを追加
    for i in range(len_steps):
        form_data[f'step{i+1}_minute'] = i
        form_data[f'step{i+1}_second'] = 0
        form_data[f'step{i+1}_water'] = 100.0 * (i + 1)
    
    return form_data
