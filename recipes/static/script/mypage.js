'use strict';

$(document).ready(function() {
    // モーダル表示ボタンのイベント
    $('#email-change-btn').on('click', function() {
        $('#email-change-modal').show();
    });

    $('#password-change-btn').on('click', function() {
        $('#password-change-modal').show();
    });

    $('#account-delete-btn').on('click', function() {
        $('#account-delete-modal').show();
    });

    // モーダル閉じるボタンのイベント
    $('.close, #cancel-email-change, #cancel-password-change, #cancel-account-delete, #close-purchase-cancel-btn, #close-purchase-success-btn, #close-password-reset-sent-btn, #close-password-reset-success-btn, #close-not-subscribed-modal, #close-not-subscribed-btn').on('click', function() {
        $(this).closest('.modal').hide();
    });

    // モーダル外クリックで閉じる
    $('.modal').on('click', function(e) {
        if (e.target === this) {
            $(this).hide();
        }
    });

    // メールアドレス変更フォーム送信
    $('#email-change-form').on('submit', function(e) {
        e.preventDefault();
        
        const formData = {
            email: $('#new-email').val(),
            csrfmiddlewaretoken: $('[name=csrfmiddlewaretoken]').val()
        };

        $.ajax({
            url: '/users/email_change/',
            method: 'POST',
            data: formData,
            success: function(response) {
                $('#email-change-modal').hide();
                showSuccessModal('確認メールを送信しました。新しいメールアドレスの受信ボックスを確認してください。');
            },
            error: function(xhr) {
                let errorMessage = 'メールアドレス変更に失敗しました。';
                if (xhr.responseJSON && xhr.responseJSON.error) {
                    errorMessage = xhr.responseJSON.error;
                }
                showErrorModal(errorMessage);
            }
        });
    });

    // パスワード変更フォーム送信
    $('#password-change-form').on('submit', function(e) {
        e.preventDefault();
        
        const newPassword1 = $('#new-password1').val();
        const newPassword2 = $('#new-password2').val();
        
        if (newPassword1 !== newPassword2) {
            showErrorModal('新しいパスワードが一致しません。');
            return;
        }

        const formData = {
            old_password: $('#old-password').val(),
            new_password1: newPassword1,
            new_password2: newPassword2,
            csrfmiddlewaretoken: $('[name=csrfmiddlewaretoken]').val()
        };

        $.ajax({
            url: '/users/password_change/',
            method: 'POST',
            data: formData,
            success: function(response) {
                $('#password-change-modal').hide();
                showSuccessModal('パスワードを変更しました。');
                // フォームをリセット
                $('#password-change-form')[0].reset();
            },
            error: function(xhr) {
                let errorMessage = 'パスワード変更に失敗しました。';
                if (xhr.responseJSON && xhr.responseJSON.error) {
                    errorMessage = xhr.responseJSON.error;
                }
                showErrorModal(errorMessage);
            }
        });
    });

    // 退会確認
    $('#confirm-account-delete').on('click', function() {
        $.ajax({
            url: '/users/account_delete/',
            method: 'POST',
            data: {
                csrfmiddlewaretoken: $('[name=csrfmiddlewaretoken]').val()
            },
            success: function(response) {
                // 退会成功時はログアウトしてトップページへリダイレクト
                window.location.href = '/';
            },
            error: function(xhr) {
                showErrorModal('退会処理に失敗しました。');
            }
        });
    });

    // サブスクリプションポータルボタン
    $('#portal-session-btn').on('click', function() {
        window.location.href = '/purchase/create_portal_session';
    });

    // サブスク状況確認・解約ボタン
    $('#subscription-status-btn').on('click', function() {
        // 契約状況をチェック
        const subscriptionStatus = $(this).data('subscription-status');
        if (subscriptionStatus === '未契約') {
            // 未契約の場合はモーダルを表示
            $('#not-subscribed-modal').show();
        } else {
            // 契約済みの場合はカスタマーポータルに遷移
            window.location.href = '/purchase/create_portal_session';
        }
    });

    // モーダル内のサブスク新規契約ボタン
    $('#subscribe-from-modal-btn').on('click', function() {
        $('#not-subscribed-modal').hide();
        window.location.href = '/purchase/create_checkout_session';
    });

    // 成功モーダル表示
    function showSuccessModal(message) {
        // 既存の成功モーダルがある場合はそれを使用、なければ新しく作成
        let modal = $('#success-modal');
        if (modal.length === 0) {
            $('body').append(`
                <div id="success-modal" class="modal" style="display: none;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <div class="modal-title">
                                <h3>成功</h3>
                            </div>
                            <span class="close" id="close-success-modal">&times;</span>
                        </div>
                        <div class="modal-body">
                            <p id="success-message">${message}</p>
                            <div class="modal-actions">
                                <button id="close-success-btn" class="btn btn-primary">閉じる</button>
                            </div>
                        </div>
                    </div>
                </div>
            `);
            modal = $('#success-modal');
            
            // 新しく作成したモーダルのイベントを設定
            $('#close-success-modal, #close-success-btn').on('click', function() {
                modal.hide();
            });
        } else {
            $('#success-message').text(message);
        }
        modal.show();
    }

    // エラーモーダル表示
    function showErrorModal(message) {
        // 既存のエラーモーダルがある場合はそれを使用、なければ新しく作成
        let modal = $('#error-modal');
        if (modal.length === 0) {
            $('body').append(`
                <div id="error-modal" class="modal" style="display: none;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <div class="modal-title">
                                <h3>エラー</h3>
                            </div>
                            <span class="close" id="close-error-modal">&times;</span>
                        </div>
                        <div class="modal-body">
                            <p id="error-message">${message}</p>
                            <div class="modal-actions">
                                <button id="close-error-btn" class="btn btn-secondary">閉じる</button>
                            </div>
                        </div>
                    </div>
                </div>
            `);
            modal = $('#error-modal');
            
            // 新しく作成したモーダルのイベントを設定
            $('#close-error-modal, #close-error-btn').on('click', function() {
                modal.hide();
            });
        } else {
            $('#error-message').text(message);
        }
        modal.show();
    }

    // URLパラメータからモーダル表示を判定
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('purchase_cancel') === 'true') {
        $('#purchase-cancel-modal').show();
        // URLからパラメータを削除
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('purchase_success') === 'true') {
        $('#purchase-success-modal').show();
        // URLからパラメータを削除
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('password_reset_sent') === 'true') {
        $('#password-reset-sent-modal').show();
        // URLからパラメータを削除
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('password_reset_success') === 'true') {
        $('#password-reset-success-modal').show();
        // URLからパラメータを削除
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});
