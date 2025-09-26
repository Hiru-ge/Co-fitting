"""
プロジェクト全体で使用するレスポンス作成のヘルパークラス
"""
from django.http import JsonResponse


class ResponseHelper:
    """レスポンス作成のヘルパークラス"""
    
    @staticmethod
    def create_error_response(error_type, message, status_code=400, details=None):
        """統一されたエラーレスポンスを作成"""
        response_data = {
            'error': error_type,
            'message': message
        }
        if details:
            response_data['details'] = details
        return JsonResponse(response_data, status=status_code)
    
    @staticmethod
    def create_success_response(message, data=None, status_code=200):
        """統一された成功レスポンスを作成"""
        response_data = {
            'success': True,
            'message': message
        }
        if data:
            response_data.update(data)
        return JsonResponse(response_data, status=status_code)
    
    @staticmethod
    def create_data_response(data, status_code=200):
        """データのみのレスポンスを作成"""
        return JsonResponse(data, status=status_code)
    
    @staticmethod
    def create_validation_error_response(form_errors, message="データの検証に失敗しました。"):
        """フォームバリデーションエラーレスポンスを作成"""
        return JsonResponse({
            'error': 'validation_error',
            'message': message,
            'errors': form_errors
        }, status=400)
    
    @staticmethod
    def create_authentication_error_response(message="認証が必要です。"):
        """認証エラーレスポンスを作成"""
        return JsonResponse({
            'error': 'authentication_required',
            'message': message
        }, status=401)
    
    @staticmethod
    def create_permission_error_response(message="権限がありません。"):
        """権限エラーレスポンスを作成"""
        return JsonResponse({
            'error': 'permission_denied',
            'message': message
        }, status=403)
    
    @staticmethod
    def create_not_found_error_response(message="リソースが見つかりません。"):
        """404エラーレスポンスを作成"""
        return JsonResponse({
            'error': 'not_found',
            'message': message
        }, status=404)
    
    @staticmethod
    def create_server_error_response(message="サーバーエラーが発生しました。"):
        """500エラーレスポンスを作成"""
        return JsonResponse({
            'error': 'server_error',
            'message': message
        }, status=500)
