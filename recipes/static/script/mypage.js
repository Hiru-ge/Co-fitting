'use strict';

$(document).ready(function() {
    // モーダル表示ボタンのイベント
    $('#email-change-btn').on('click', function() {
        ModalWindow.show('email-change-modal');
    });

    $('#password-change-btn').on('click', function() {
        ModalWindow.show('password-change-modal');
    });

    $('#account-delete-btn').on('click', function() {
        ModalWindow.show('account-delete-modal');
    });

    // モーダル閉じるボタンのイベント（ModalManagerが自動処理するため、個別のキャンセルボタンのみ）
    $('#cancel-email-change, #cancel-password-change, #cancel-account-delete, #close-purchase-cancel-btn, #close-purchase-success-btn, #close-password-reset-sent-btn, #close-password-reset-success-btn, #close-not-subscribed-modal, #close-not-subscribed-btn, #cancel-delete-btn, #close-delete-confirm-modal').on('click', function() {
        const modalId = $(this).closest('.modal').attr('id');
        ModalWindow.hide(modalId);
    });

    // モーダル外クリックで閉じる（ModalManagerが自動処理）

    // メールアドレス変更フォーム送信
    $('#email-change-form').on('submit', function(e) {
        e.preventDefault();
        
        const formData = {
            email: $('#new-email').val(),
            csrfmiddlewaretoken: getCSRFToken()
        };

        $.ajax({
            url: '/users/email_change/',
            method: 'POST',
            data: formData,
            success: function(response) {
                ModalWindow.hide('email-change-modal');
                ModalWindow.showSuccess('確認メールを送信しました。新しいメールアドレスの受信ボックスを確認してください。');
            },
            error: function(xhr) {
                let errorMessage = 'メールアドレス変更に失敗しました。';
                if (xhr.responseJSON && xhr.responseJSON.error) {
                    errorMessage = xhr.responseJSON.error;
                }
                ModalWindow.showError(errorMessage);
            }
        });
    });

    // パスワード変更フォーム送信
    $('#password-change-form').on('submit', function(e) {
        e.preventDefault();
        
        const newPassword1 = $('#new-password1').val();
        const newPassword2 = $('#new-password2').val();
        
        if (newPassword1 !== newPassword2) {
            ModalWindow.showError('新しいパスワードが一致しません。');
            return;
        }

        const formData = {
            old_password: $('#old-password').val(),
            new_password1: newPassword1,
            new_password2: newPassword2,
            csrfmiddlewaretoken: getCSRFToken()
        };

        $.ajax({
            url: '/users/password_change/',
            method: 'POST',
            data: formData,
            success: function(response) {
                ModalWindow.hide('password-change-modal');
                ModalWindow.showSuccess(response.message);
                // フォームをリセット
                $('#password-change-form')[0].reset();
                
                // リダイレクトURLが指定されている場合はリダイレクト
                if (response.redirect_url) {
                    setTimeout(function() {
                        window.location.href = response.redirect_url;
                    }, 2000); // 2秒後にリダイレクト
                }
            },
            error: function(xhr) {
                let errorMessage = 'パスワード変更に失敗しました。';
                if (xhr.responseJSON && xhr.responseJSON.error) {
                    const error = xhr.responseJSON.error;
                    if (typeof error === 'string') {
                        errorMessage = error;
                    } else if (typeof error === 'object') {
                        // エラーオブジェクトから最初のエラーメッセージを取得
                        const errorMessages = [];
                        for (const field in error) {
                            if (error[field]) {
                                errorMessages.push(error[field]);
                            }
                        }
                        if (errorMessages.length > 0) {
                            errorMessage = errorMessages[0];
                        }
                    }
                }
                ModalWindow.showError(errorMessage);
            }
        });
    });

    // 退会確認
    $('#confirm-account-delete').on('click', function() {
        $.ajax({
            url: '/users/account_delete/',
            method: 'POST',
            data: {
                csrfmiddlewaretoken: getCSRFToken()
            },
            success: function(response) {
                // 退会成功時はログアウトしてトップページへリダイレクト
                window.location.href = '/';
            },
            error: function(xhr) {
                ModalWindow.showError('退会処理に失敗しました。');
            }
        });
    });

    // サブスクリプションポータルボタン
    $('#portal-session-btn').on('click', function() {
        window.location.href = '/purchase/create_portal_session/';
    });

    // サブスク状況確認・解約ボタン
    $('#subscription-status-btn').on('click', function() {
        // 契約状況をチェック
        const subscriptionStatus = $(this).data('subscription-status');
        if (subscriptionStatus === '未契約') {
            // 未契約の場合はモーダルを表示
            ModalWindow.show('not-subscribed-modal');
        } else {
            // 契約済みの場合はカスタマーポータルに遷移
            window.location.href = '/purchase/create_portal_session/';
        }
    });

    // モーダル内のサブスク新規契約ボタン
    $('#subscribe-from-modal-btn').on('click', function() {
        ModalWindow.hide('not-subscribed-modal');
        window.location.href = '/purchase/create_checkout_session/';
    });

    // 成功・エラーモーダルはModalWindowのメソッドを直接使用

    // プリセット共有ボタンのイベント（マイプリセットセクション）
    $(document).on('click', '.item:not(.shared-recipe-item) .share-preset-btn', function() {
        const recipeId = $(this).data('recipe-id');
        const recipeName = $(this).data('recipe-name');
        sharePresetRecipe(recipeId, recipeName);
    });

    // 共有レシピ一覧の読み込み
    loadSharedRecipes();

    // サブスクリプション状態を更新する関数
    function updateSubscriptionStatus() {
        $.ajax({
            url: '/purchase/get_preset_limit/',
            method: 'GET',
            success: function(response) {
                // プリセット枠数を更新
                $('p:contains("所有プリセット枠")').html(`所有プリセット枠: <b>${response.preset_limit}</b>`);
                
                // サブスクリプション状態を判定して更新
                const isSubscribed = response.preset_limit > 1;
                const statusText = isSubscribed ? '契約中' : '未契約';
                $('p:contains("サブスクリプション契約状況")').html(`サブスクリプション契約状況: <b>${statusText}</b>`);
                
                // ボタンのdata属性も更新
                $('#subscription-status-btn').data('subscription-status', statusText);
            },
            error: function(xhr) {
                console.error('サブスクリプション状態の取得に失敗しました:', xhr);
            }
        });
    }

    // URLパラメータからモーダル表示を判定
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('purchase_cancel') === 'true') {
        ModalWindow.show('purchase-cancel-modal');
        // URLからパラメータを削除
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('purchase_success') === 'true') {
        // サブスクリプション状態を更新してからモーダルを表示
        updateSubscriptionStatus();
        ModalWindow.show('purchase-success-modal');
        // URLからパラメータを削除
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('password_reset_sent') === 'true') {
        ModalWindow.show('password-reset-sent-modal');
        // URLからパラメータを削除
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('password_reset_success') === 'true') {
        ModalWindow.show('password-reset-success-modal');
        // URLからパラメータを削除
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // プリセット共有機能
    function sharePresetRecipe(recipeId, recipeName) {
        $.ajax({
            url: `/api/preset-share/${recipeId}/`,
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            },
            success: function(response) {
                const shareUrl = `/share/${response.access_token}/`;
                shareToSocialMedia(shareUrl, { name: recipeName });
                loadSharedRecipes(); // 一覧を更新
            },
            error: function(xhr) {
                if (xhr.status === 401) {
                    ModalWindow.showError('ログインが必要です。');
                } else if (xhr.status === 429) {
                    const data = xhr.responseJSON;
                    ModalWindow.showShareLimit(data);
                } else if (xhr.status === 400) {
                    const data = xhr.responseJSON;
                    ModalWindow.showError(data.message || '入力データに問題があります。');
                } else {
                    ModalWindow.showError('共有URLの生成に失敗しました。');
                }
            }
        });
    }

    // 共有レシピ一覧の読み込み
    function loadSharedRecipes() {
        $.ajax({
            url: '/api/shared-recipes/',
            method: 'GET',
            success: function(response) {
                displaySharedRecipes(response.shared_recipes);
            },
            error: function(xhr) {
                console.error('共有レシピ一覧の読み込みに失敗しました:', xhr);
            }
        });
    }

    // 共有レシピ一覧の表示
    function displaySharedRecipes(sharedRecipes) {
        const container = $('#shared-recipes-list');
        container.empty();

        if (sharedRecipes.length === 0) {
            container.html('<p>現在共有しているレシピはありません。</p>');
            return;
        }

        sharedRecipes.forEach(function(recipe) {
            const recipeHtml = `
                <div class="item shared-recipe-item" data-token="${recipe.access_token}">
                    <div class="recipe-info">
                        <span class="recipe-name">${recipe.name}</span>
                        <span class="recipe-date">作成日: ${new Date(recipe.created_at).toLocaleDateString('ja-JP')}</span>
                    </div>
                    <div class="button-parent">
                        <button class="edit-share-name-btn" data-token="${recipe.access_token}" data-name="${recipe.name}">編集</button>
                        <button class="delete-shared-recipe-btn" data-token="${recipe.access_token}">削除</button>
                        <button class="share-preset-btn" data-url="/share/${recipe.access_token}/" title="URLコピー">
                            <img src="/static/images/share-icon.png" alt="共有" />
                        </button>
                    </div>
                </div>
            `;
            container.append(recipeHtml);
        });
    }

    // 共有レシピ一覧の共有ボタン（URLコピー）
    $(document).on('click', '.shared-recipe-item .share-preset-btn', function() {
        const url = window.location.origin + $(this).data('url');
        navigator.clipboard.writeText(url).then(function() {
            ModalWindow.showSuccess('共有URLをクリップボードにコピーしました。');
        }).catch(function() {
            ModalWindow.showError('URLのコピーに失敗しました。');
        });
    });

    // 共有レシピ編集ボタン
    $(document).on('click', '.edit-share-name-btn', function() {
        const token = $(this).data('token');
        // 共有レシピ編集ページに遷移
        window.location.href = `/shared-recipe-edit/${token}/`;
    });

    // プリセット編集ボタン
    $(document).on('click', '.edit-preset-btn', function() {
        const recipeId = $(this).data('recipe-id');
        window.location.href = `/preset_edit/${recipeId}/`;
    });

    // プリセット削除ボタン
    $(document).on('click', '.delete-preset-btn', function() {
        const recipeId = $(this).data('recipe-id');
        const recipeName = $(this).data('recipe-name');
        showDeleteConfirmModal('preset', recipeId, recipeName);
    });

    // 共有レシピ削除ボタン
    $(document).on('click', '.delete-shared-recipe-btn', function() {
        const token = $(this).data('token');
        const recipeName = $(this).closest('.shared-recipe-item').find('.recipe-name').text();
        showDeleteConfirmModal('shared', token, recipeName);
    });


    // 削除確認モーダル表示
    function showDeleteConfirmModal(type, id, name) {
        const message = `「${name}」を削除しますか？この操作は取り消せません。`;
        $('#delete-confirm-message').text(message);
        
        // 削除ボタンのイベントを設定
        $('#confirm-delete-btn').off('click').on('click', function() {
            ModalWindow.hide('delete-confirm-modal');
            if (type === 'preset') {
                deletePreset(id);
            } else if (type === 'shared') {
                deleteSharedRecipe(id);
            }
        });
        
        ModalWindow.show('delete-confirm-modal');
    }

    // プリセット削除
    function deletePreset(recipeId) {
        $.ajax({
            url: `/preset_delete/${recipeId}/`,
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            },
            success: function(response) {
                ModalWindow.showSuccess('プリセットを削除しました。');
                // ページをリロードして一覧を更新
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            },
            error: function(xhr) {
                ModalWindow.showError('プリセットの削除に失敗しました。');
            }
        });
    }

    // 共有レシピ削除
    function deleteSharedRecipe(token) {
        $.ajax({
            url: `/api/shared-recipes/${token}/delete/`,
            method: 'DELETE',
            headers: {
                'X-CSRFToken': getCSRFToken()
            },
            success: function(response) {
                ModalWindow.showSuccess('共有レシピを削除しました。');
                loadSharedRecipes(); // 一覧を更新
            },
            error: function(xhr) {
                ModalWindow.showError('共有レシピの削除に失敗しました。');
            }
        });
    }

    // Web Share APIを使用してSNS投稿
    async function shareToSocialMedia(shareUrl, recipeData) {
        const shareData = {
            title: 'Co-fitting レシピ',
            text: `Co-fittingからレシピ「${recipeData.name}」を共有しました! #Cofitting`,
            url: shareUrl
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
                ModalWindow.showSuccess('レシピを共有しました！');
            } catch (error) {
                if (error.name !== 'AbortError') {
                    // 共有がキャンセルされた場合は何もしない
                    copyToClipboard(shareUrl);
                }
            }
        } else {
            // Web Share APIが利用できない場合はクリップボードにコピー
            copyToClipboard(shareUrl);
        }
    }

    // クリップボードにコピー
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(function() {
            ModalWindow.showSuccess('共有URLをクリップボードにコピーしました。');
        }).catch(function() {
            ModalWindow.showError('URLのコピーに失敗しました。');
        });
    }
});
