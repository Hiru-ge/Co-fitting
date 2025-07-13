'use strict';

$(document).ready(function() {
    // プリセット追加ボタンのクリックイベント
    $('#add-to-preset-btn').on('click', function() {
        addToPreset();
    });

    // モーダル閉じるボタンのイベント
    $('#close-success-modal, #close-error-modal').on('click', function() {
        closeModal($(this).closest('.modal'));
    });

    // モーダル外クリックで閉じる
    $('.modal').on('click', function(e) {
        if (e.target === this) {
            closeModal($(this));
        }
    });

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
                'X-CSRFToken': getCookie('csrftoken')
            },
            success: function(response) {
                showSuccessModal();
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
                
                showErrorModal(errorMessage);
            },
            complete: function() {
                // ボタンを再有効化
                $('#add-to-preset-btn').prop('disabled', false).html('追加');
            }
        });
    }

    // 成功モーダル表示
    function showSuccessModal() {
        $('#success-modal').show();
    }

    // エラーモーダル表示
    function showErrorModal(message) {
        $('#error-message').text(message);
        $('#error-modal').show();
    }

    // モーダル閉じる
    function closeModal(modal) {
        modal.hide();
    }

    // CSRFトークンを取得する関数
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    // ページ読み込み時の初期化
    function initializePage() {
        // レシピ画像の読み込みエラーハンドリング
        $('.recipe-preview-image').on('error', function() {
            $(this).hide();
            $(this).parent().append('<p class="image-error">画像の読み込みに失敗しました</p>');
        });
    }

    // 初期化実行
    initializePage();
}); 