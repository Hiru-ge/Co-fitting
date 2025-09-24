'use strict';

$(document).ready(function() {
    // プリセット追加ボタンのクリックイベント（イベントデリゲーションを使用）
    // 注意: index.jsでも同じイベントハンドラーが設定されているため、重複を避ける
    // $(document).on('click', '#add-to-preset-btn', function() {
    //     addToPreset();
    // });

    // キャンセルボタンのクリックイベント（イベントデリゲーションを使用）
    // 注意: data-modal-close属性により、common.jsで自動的に処理される
    // $(document).on('click', '#cancel-shared-btn', function() {
    //     ModalWindow.hide('shared-recipe-modal');
    // });

    // モーダル閉じるボタンのイベント
    $('#close-success-modal, #close-error-modal, #close-success-btn, #close-error-btn').on('click', function() {
        ModalWindow.hide($(this).closest('.modal').attr('id'));
    });

    // モーダル外クリックで閉じる（グローバルイベントハンドラーで処理）

    // プリセット追加処理
    function addToPreset() {
        // ボタンを無効化
        $('#add-to-preset-btn').prop('disabled', true).text('追加中...');
        
        // 共有レシピのトークンを取得（URLから）
        const token = window.location.pathname.split('/').pop();
        
        // バックエンドAPIにリクエスト
        $.ajax({
            url: `/api/shared-recipes/${token}/add-to-preset/`,
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            },
            success: function(response) {
                ModalWindow.showSuccess();
            },
            error: function(xhr) {
                let errorMessage = 'レシピの追加に失敗しました。';
                
                if (xhr.status === 400) {
                    const data = xhr.responseJSON;
                    if (data.error === 'preset_limit_exceeded') {
                        errorMessage = 'プリセットの保存上限に達しました。枠を増やすにはサブスクリプションをご検討ください。';
                    } else if (data.error === 'preset_limit_exceeded_premium') {
                        errorMessage = 'プリセットの保存上限に達しました。既存のプリセットを整理してください。';
                    }
                } else if (xhr.status === 404) {
                    errorMessage = 'この共有リンクは存在しません。';
                } else if (xhr.status === 410) {
                    errorMessage = 'この共有リンクは期限切れです。';
                }
                
                ModalWindow.showError(errorMessage);
            },
            complete: function() {
                // ボタンを再有効化
                $('#add-to-preset-btn').prop('disabled', false).html('追加');
            }
        });
    }

    // 成功・エラーモーダルはModalWindowのメソッドを直接使用

    // モーダル閉じる（ModalWindow.hideを直接使用）

    // CSRFトークン取得はcommon.jsのgetCSRFToken()を使用

    // ページ読み込み時の初期化
    function initializePage() {
        // レシピ画像の読み込みエラーハンドリング
        $('.recipe-preview-image').on('error', function() {
            ModalWindow.hide($(this).attr('id'));
            $(this).parent().append('<p class="image-error">画像の読み込みに失敗しました</p>');
        });
    }

    // 初期化実行
    initializePage();
}); 