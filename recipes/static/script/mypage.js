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
    $('.close, #cancel-email-change, #cancel-password-change, #cancel-account-delete, #close-purchase-cancel-btn, #close-purchase-success-btn, #close-password-reset-sent-btn, #close-password-reset-success-btn, #close-not-subscribed-modal, #close-not-subscribed-btn, #cancel-delete-btn, #close-delete-confirm-modal').on('click', function() {
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
                <div id="success-modal" class="modal modal-hidden">
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
                <div id="error-modal" class="modal modal-hidden">
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

    // プリセット共有ボタンのイベント（マイプリセットセクション）
    $(document).on('click', '.item:not(.shared-recipe-item) .share-preset-btn', function() {
        const recipeId = $(this).data('recipe-id');
        const recipeName = $(this).data('recipe-name');
        sharePresetRecipe(recipeId, recipeName);
    });

    // 共有レシピ一覧の読み込み
    loadSharedRecipes();

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

    // プリセット共有機能
    function sharePresetRecipe(recipeId, recipeName) {
        $.ajax({
            url: `/api/preset-share/${recipeId}/`,
            method: 'POST',
            headers: {
                'X-CSRFToken': $('[name=csrfmiddlewaretoken]').val()
            },
            success: function(response) {
                const shareUrl = `/share/${response.access_token}/`;
                shareToSocialMedia(shareUrl, { name: recipeName });
                loadSharedRecipes(); // 一覧を更新
            },
            error: function(xhr) {
                if (xhr.status === 401) {
                    showErrorModal('ログインが必要です。');
                } else if (xhr.status === 429) {
                    const data = xhr.responseJSON;
                    showShareLimitModal(data);
                } else if (xhr.status === 400) {
                    const data = xhr.responseJSON;
                    showErrorModal(data.message || '入力データに問題があります。');
                } else {
                    showErrorModal('共有URLの生成に失敗しました。');
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
            showSuccessModal('共有URLをクリップボードにコピーしました。');
        }).catch(function() {
            showErrorModal('URLのコピーに失敗しました。');
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
            $('#delete-confirm-modal').hide();
            if (type === 'preset') {
                deletePreset(id);
            } else if (type === 'shared') {
                deleteSharedRecipe(id);
            }
        });
        
        $('#delete-confirm-modal').show();
    }

    // プリセット削除
    function deletePreset(recipeId) {
        $.ajax({
            url: `/preset_delete/${recipeId}/`,
            method: 'POST',
            headers: {
                'X-CSRFToken': $('[name=csrfmiddlewaretoken]').val()
            },
            success: function(response) {
                showSuccessModal('プリセットを削除しました。');
                // ページをリロードして一覧を更新
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            },
            error: function(xhr) {
                showErrorModal('プリセットの削除に失敗しました。');
            }
        });
    }

    // 共有レシピ削除
    function deleteSharedRecipe(token) {
        $.ajax({
            url: `/api/shared-recipes/${token}/delete/`,
            method: 'DELETE',
            headers: {
                'X-CSRFToken': $('[name=csrfmiddlewaretoken]').val()
            },
            success: function(response) {
                showSuccessModal('共有レシピを削除しました。');
                loadSharedRecipes(); // 一覧を更新
            },
            error: function(xhr) {
                showErrorModal('共有レシピの削除に失敗しました。');
            }
        });
    }

    // 共有制限オーバー時のモーダル表示（index.jsと同じ機能）
    function showShareLimitModal(data) {
        const isPremium = data.is_premium || false;
        const currentCount = data.current_count || 0;
        const limit = data.limit || 1;
        
        let modalContent = `
            <div class="modal-header">
                <div class="modal-title">
                    <h3>共有制限に達しました</h3>
                </div>
                <span class="close" id="close-share-limit-modal">&times;</span>
            </div>
            <div class="modal-body">
                <p>${data.message}</p>
                <p>現在の共有レシピ数: ${currentCount}/${limit}</p>
        `;
        
        if (!isPremium) {
            modalContent += `
                <div class="modal-actions">
                    <button id="subscribe-btn" class="btn btn-primary">サブスク契約</button>
                    <button id="manage-shares-btn" class="btn btn-secondary">共有レシピ管理</button>
                </div>
            `;
        } else {
            modalContent += `
                <div class="modal-actions">
                    <button id="manage-shares-btn" class="btn btn-primary">共有レシピ管理</button>
                    <button id="close-share-limit-btn" class="btn btn-secondary">閉じる</button>
                </div>
            `;
        }
        
        modalContent += `
            </div>
        `;
        
        // モーダルが既に存在する場合は削除
        $('#share-limit-modal').remove();
        
        const modalHtml = `
            <div id="share-limit-modal" class="modal" style="display: block;">
                <div class="modal-content">
                    ${modalContent}
                </div>
            </div>
        `;
        
        $('body').append(modalHtml);
        
        // イベント設定
        $('#close-share-limit-modal, #close-share-limit-btn').on('click', function() {
            $('#share-limit-modal').remove();
        });
        
        $('#subscribe-btn').on('click', function() {
            $('#share-limit-modal').remove();
            window.location.href = '/purchase/create_checkout_session';
        });
        
        $('#manage-shares-btn').on('click', function() {
            $('#share-limit-modal').remove();
            // 既にマイページにいるので、共有レシピ一覧にスクロール
            $('html, body').animate({
                scrollTop: $('#shared-recipes').offset().top
            }, 500);
        });
        
        // モーダル外クリックで閉じる
        $('#share-limit-modal').on('click', function(e) {
            if (e.target === this) {
                $(this).remove();
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
                showSuccessModal('レシピを共有しました！');
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
            showSuccessModal('共有URLをクリップボードにコピーしました。');
        }).catch(function() {
            showErrorModal('URLのコピーに失敗しました。');
        });
    }
});
