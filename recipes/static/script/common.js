'use strict';

// 規定文字数入力されたら次のフォームにフォーカスを移すユーザー補助
function nextField(str) {
    if (str.value.length >= str.maxLength) {
        for (var i = 0, elm = str.form.elements; i < elm.length; i++) {
            if (elm[i] == str) {
                // 50msの遅延を加えてフォーカスを移動
                setTimeout(function() {
                    (elm[i + 1] || elm[0]).focus();
                }, 50);
                break;
            }
        }
    }
    return (str);
}

$(document).ready(function() {
    // ハンバーガーメニューの開閉
    $('.hamburger').on('click', function() {
        $('.hamburger, .slide-menu').toggleClass('active');
    });

    // ページトップへ戻るボタン
    $('.pageTop-button').on('click', function() {
        event.preventDefault();
        $('body, html').animate({ scrollTop: 0 }, 500);
    });

    // インラインJavaScriptの代替：nextFieldイベントリスナー
    $(document).on('keyup', 'input[maxlength]', function() {
        nextField(this);
    });
});


// シンプルなモーダルウィンドウ表示ユーティリティ
const ModalWindow = {
    // 既存モーダルを表示
    show(modalId) {
        $(`#${modalId}`).removeClass('modal-hidden').css('display', 'block');
    },
    
    // モーダルを非表示
    hide(modalId) {
        $(`#${modalId}`).addClass('modal-hidden');
    },
    
    // 新規モーダルを作成して表示
    createAndShow(modalId, title, content) {
        const modalHtml = `
            <div id="${modalId}" class="modal" style="display: block;">
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-title">
                            <h3>${title}</h3>
                        </div>
                        <span class="close">&times;</span>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                </div>
            </div>
        `;
        
        // 既存のモーダルがあれば削除
        $(`#${modalId}`).remove();
        
        // 新しいモーダルを追加して表示
        $('body').append(modalHtml);
        
        return $(`#${modalId}`);
    },
    
    // 成功メッセージを表示
    showSuccess(message) {
        const content = `
            <p>${message}</p>
            <div class="modal-actions">
                <button type="button" class="btn btn-primary" data-modal-close>閉じる</button>
            </div>
        `;
        
        return this.createAndShow('success-modal', '成功', content);
    },
    
    // エラーメッセージを表示
    showError(message) {
        const content = `
            <p>${message}</p>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" data-modal-close>閉じる</button>
            </div>
        `;
        
        return this.createAndShow('error-modal', 'エラー', content);
    },
    
    // 共有制限モーダルを表示
    showShareLimit(data, onManageShares = null) {
        const isPremium = data.is_premium || false;
        const currentCount = data.current_count || 0;
        const limit = data.limit || 1;
        
        let content = `
            <p>${data.message}</p>
            <p>現在の共有レシピ数: ${currentCount}/${limit}</p>
            <div class="modal-actions">
        `;
        
        if (!isPremium) {
            content += `
                <button id="subscribe-btn" class="btn btn-primary">サブスク契約</button>
                <button id="manage-shares-btn" class="btn btn-secondary">共有レシピ管理</button>
            `;
        } else {
            content += `
                <button id="manage-shares-btn" class="btn btn-primary">共有レシピ管理</button>
                <button type="button" class="btn btn-secondary" data-modal-close>閉じる</button>
            `;
        }
        
        content += `</div>`;
        
        const modal = this.createAndShow('share-limit-modal', '共有制限に達しました', content);
        
        // イベント設定
        modal.find('#subscribe-btn').on('click', () => {
            this.hide('share-limit-modal');
            window.location.href = '/purchase/create_checkout_session';
        });
        
        modal.find('#manage-shares-btn').on('click', () => {
            this.hide('share-limit-modal');
            if (onManageShares) {
                onManageShares();
            } else {
                window.location.href = '/mypage#shared-recipes';
            }
        });
        
        return modal;
    },
    
    // レシピ名入力モーダルを表示
    showRecipeNameInput(onConfirm, onCancel = null) {
        const content = `
            <p>共有するレシピの名前を入力してください</p>
            <input type="text" id="recipe-name-input" class="super-wide-input" placeholder="レシピ名を入力" maxlength="30" value="共有レシピ">
            <div class="modal-actions">
                <button id="confirm-share-btn" class="btn btn-primary">共有する</button>
                <button type="button" class="btn btn-secondary" data-modal-close>キャンセル</button>
            </div>
        `;
        
        const modal = this.createAndShow('recipe-name-modal', 'レシピ名を入力', content);
        
        // イベント設定
        modal.find('#confirm-share-btn').on('click', () => {
            const recipeName = modal.find('#recipe-name-input').val().trim();
            if (!recipeName) {
                alert('レシピ名を入力してください。');
                return;
            }
            this.hide('recipe-name-modal');
            onConfirm(recipeName);
        });
        
        // エンターキーで確定
        modal.find('#recipe-name-input').on('keypress', (e) => {
            if (e.which === 13) { // Enter key
                modal.find('#confirm-share-btn').click();
            }
        });
        
        // フォーカス・選択
        modal.find('#recipe-name-input').focus().select();
        
        return modal;
    }
};

// CSRFトークン取得の統一関数
function getCSRFToken() {
    // フォームから取得を試行
    const formToken = $('[name=csrfmiddlewaretoken]').val();
    if (formToken) {
        return formToken;
    }
    
    // Cookieから取得
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, 10) === 'csrftoken=') {
                cookieValue = decodeURIComponent(cookie.substring(10));
                break;
            }
        }
    }
    return cookieValue;
}

// グローバルなモーダルイベントハンドラーを設定
$(document).ready(function() {
    // 閉じるボタンのクリック（×ボタン）
    $(document).on('click', '.modal .close', function() {
        const modalId = $(this).closest('.modal').attr('id');
        ModalWindow.hide(modalId);
    });
    
    // data-modal-close属性を持つボタンのクリック
    $(document).on('click', '[data-modal-close]', function() {
        const modalId = $(this).closest('.modal').attr('id');
        ModalWindow.hide(modalId);
    });
    
    // モーダル外クリックで閉じる
    $(document).on('click', '.modal', function(e) {
        if (e.target === this) {
            const modalId = $(this).attr('id');
            ModalWindow.hide(modalId);
        }
    });
});
