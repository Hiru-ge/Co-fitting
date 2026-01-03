from django.test import TestCase
import json
from Co_fitting.utils.response_helper import ResponseHelper
from Co_fitting.tests.helpers import BaseTestCase


class ResponseHelperTestCase(BaseTestCase):
    """ResponseHelperクラスのテスト"""

    def test_create_error_response_format(self):
        """エラーレスポンスの形式が正しいことをテスト"""
        response = ResponseHelper.create_error_response(
            error_type='test_error',
            message='テストエラーメッセージ',
            status_code=400
        )

        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['error'], 'test_error')
        self.assertEqual(response_data['message'], 'テストエラーメッセージ')
        self.assertNotIn('details', response_data)

    def test_create_error_response_with_details(self):
        """詳細情報付きエラーレスポンスのテスト"""
        details = {'field': 'email', 'reason': 'invalid format'}
        response = ResponseHelper.create_error_response(
            error_type='validation_error',
            message='バリデーションエラー',
            status_code=400,
            details=details
        )

        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['error'], 'validation_error')
        self.assertEqual(response_data['message'], 'バリデーションエラー')
        self.assertIn('details', response_data)
        self.assertEqual(response_data['details'], details)

    def test_create_success_response_format(self):
        """成功レスポンスの形式が正しいことをテスト"""
        response = ResponseHelper.create_success_response(
            message='処理が成功しました',
            status_code=200
        )

        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        self.assertTrue(response_data['success'])
        self.assertEqual(response_data['message'], '処理が成功しました')

    def test_create_success_response_with_data(self):
        """データ付き成功レスポンスのテスト"""
        data = {'user_id': 123, 'username': 'testuser'}
        response = ResponseHelper.create_success_response(
            message='ユーザー取得成功',
            data=data,
            status_code=200
        )

        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        self.assertTrue(response_data['success'])
        self.assertEqual(response_data['message'], 'ユーザー取得成功')
        self.assertEqual(response_data['user_id'], 123)
        self.assertEqual(response_data['username'], 'testuser')

    def test_create_data_response(self):
        """データレスポンスのテスト"""
        data = {'items': [1, 2, 3], 'count': 3}
        response = ResponseHelper.create_data_response(data, status_code=200)

        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['items'], [1, 2, 3])
        self.assertEqual(response_data['count'], 3)

    def test_create_validation_error_response_with_form_errors(self):
        """フォームエラー付きバリデーションエラーレスポンスのテスト"""
        form_errors = {
            'email': ['このメールアドレスは既に登録されています。'],
            'password': ['パスワードは8文字以上である必要があります。']
        }
        response = ResponseHelper.create_validation_error_response(
            form_errors=form_errors,
            message='入力内容を確認してください。'
        )

        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['error'], 'validation_error')
        self.assertEqual(response_data['message'], '入力内容を確認してください。')
        self.assertIn('errors', response_data)
        self.assertEqual(response_data['errors'], form_errors)

    def test_create_validation_error_response_default_message(self):
        """デフォルトメッセージのバリデーションエラーレスポンスのテスト"""
        form_errors = {'field': ['エラー']}
        response = ResponseHelper.create_validation_error_response(
            form_errors=form_errors
        )

        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['message'], 'データの検証に失敗しました。')

    def test_create_authentication_error_response_status_code(self):
        """認証エラーレスポンスのステータスコードテスト"""
        response = ResponseHelper.create_authentication_error_response(
            message='ログインが必要です。'
        )

        self.assertEqual(response.status_code, 401)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['error'], 'authentication_required')
        self.assertEqual(response_data['message'], 'ログインが必要です。')

    def test_create_authentication_error_response_default_message(self):
        """デフォルトメッセージの認証エラーレスポンスのテスト"""
        response = ResponseHelper.create_authentication_error_response()

        self.assertEqual(response.status_code, 401)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['message'], '認証が必要です。')

    def test_create_permission_error_response_format(self):
        """権限エラーレスポンスの形式テスト"""
        response = ResponseHelper.create_permission_error_response(
            message='この操作を実行する権限がありません。'
        )

        self.assertEqual(response.status_code, 403)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['error'], 'permission_denied')
        self.assertEqual(response_data['message'], 'この操作を実行する権限がありません。')

    def test_create_permission_error_response_default_message(self):
        """デフォルトメッセージの権限エラーレスポンスのテスト"""
        response = ResponseHelper.create_permission_error_response()

        self.assertEqual(response.status_code, 403)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['message'], '権限がありません。')

    def test_create_not_found_error_response_json_structure(self):
        """404エラーレスポンスのJSON構造テスト"""
        response = ResponseHelper.create_not_found_error_response(
            message='指定されたレシピが見つかりません。'
        )

        self.assertEqual(response.status_code, 404)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['error'], 'not_found')
        self.assertEqual(response_data['message'], '指定されたレシピが見つかりません。')

    def test_create_not_found_error_response_default_message(self):
        """デフォルトメッセージの404エラーレスポンスのテスト"""
        response = ResponseHelper.create_not_found_error_response()

        self.assertEqual(response.status_code, 404)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['message'], 'リソースが見つかりません。')

    def test_create_server_error_response_format(self):
        """500エラーレスポンスの形式テスト"""
        response = ResponseHelper.create_server_error_response(
            message='データベース接続エラーが発生しました。'
        )

        self.assertEqual(response.status_code, 500)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['error'], 'server_error')
        self.assertEqual(response_data['message'], 'データベース接続エラーが発生しました。')

    def test_create_server_error_response_default_message(self):
        """デフォルトメッセージの500エラーレスポンスのテスト"""
        response = ResponseHelper.create_server_error_response()

        self.assertEqual(response.status_code, 500)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['message'], 'サーバーエラーが発生しました。')


class ResponseHelperEdgeCaseTestCase(BaseTestCase):
    """ResponseHelperのエッジケーステスト"""

    def test_create_error_response_with_empty_message(self):
        """空のメッセージでのエラーレスポンステスト"""
        response = ResponseHelper.create_error_response(
            error_type='test_error',
            message='',
            status_code=400
        )

        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['message'], '')

    def test_create_success_response_with_none_data(self):
        """None data での成功レスポンステスト"""
        response = ResponseHelper.create_success_response(
            message='成功',
            data=None,
            status_code=200
        )

        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        self.assertTrue(response_data['success'])
        self.assertEqual(response_data['message'], '成功')

    def test_create_data_response_with_empty_dict(self):
        """空の辞書でのデータレスポンステスト"""
        response = ResponseHelper.create_data_response({}, status_code=200)

        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        self.assertEqual(response_data, {})

    def test_create_validation_error_response_with_empty_errors(self):
        """空のエラー辞書でのバリデーションエラーレスポンステスト"""
        response = ResponseHelper.create_validation_error_response(
            form_errors={}
        )

        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['errors'], {})

    def test_create_error_response_with_nested_details(self):
        """ネストされた詳細情報を持つエラーレスポンステスト"""
        details = {
            'errors': {
                'field1': {'type': 'required', 'message': '必須項目です'},
                'field2': {'type': 'format', 'message': '形式が不正です'}
            },
            'request_id': '12345'
        }
        response = ResponseHelper.create_error_response(
            error_type='complex_error',
            message='複雑なエラー',
            status_code=400,
            details=details
        )

        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['details'], details)

    def test_create_success_response_with_list_data(self):
        """リストデータでの成功レスポンステスト"""
        data = {'items': [{'id': 1, 'name': 'Item 1'}, {'id': 2, 'name': 'Item 2'}]}
        response = ResponseHelper.create_success_response(
            message='リスト取得成功',
            data=data,
            status_code=200
        )

        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        self.assertEqual(len(response_data['items']), 2)

    def test_create_data_response_with_custom_status_code(self):
        """カスタムステータスコードでのデータレスポンステスト"""
        data = {'message': '作成されました'}
        response = ResponseHelper.create_data_response(data, status_code=201)

        self.assertEqual(response.status_code, 201)
        response_data = json.loads(response.content)
        self.assertEqual(response_data['message'], '作成されました')

    def test_create_error_response_with_special_characters(self):
        """特殊文字を含むエラーレスポンステスト"""
        response = ResponseHelper.create_error_response(
            error_type='special_chars_error',
            message='エラー: "引用符"、改行\n、タブ\t を含むメッセージ',
            status_code=400
        )

        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content)
        self.assertIn('引用符', response_data['message'])
        self.assertIn('\n', response_data['message'])
        self.assertIn('\t', response_data['message'])

    def test_response_content_type_is_json(self):
        """すべてのレスポンスのContent-TypeがJSONであることをテスト"""
        responses = [
            ResponseHelper.create_error_response('error', 'message'),
            ResponseHelper.create_success_response('message'),
            ResponseHelper.create_data_response({}),
            ResponseHelper.create_validation_error_response({}),
            ResponseHelper.create_authentication_error_response(),
            ResponseHelper.create_permission_error_response(),
            ResponseHelper.create_not_found_error_response(),
            ResponseHelper.create_server_error_response()
        ]

        for response in responses:
            self.assertEqual(response['Content-Type'], 'application/json')

    def test_create_validation_error_response_with_multiple_field_errors(self):
        """複数フィールドエラーでのバリデーションエラーレスポンステスト"""
        form_errors = {
            'username': ['この名前は既に使用されています。', 'ユーザー名は3文字以上である必要があります。'],
            'email': ['有効なメールアドレスを入力してください。'],
            'password': ['パスワードは数字を含む必要があります。', 'パスワードは8文字以上である必要があります。']
        }
        response = ResponseHelper.create_validation_error_response(
            form_errors=form_errors
        )

        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content)
        self.assertEqual(len(response_data['errors']['username']), 2)
        self.assertEqual(len(response_data['errors']['email']), 1)
        self.assertEqual(len(response_data['errors']['password']), 2)
