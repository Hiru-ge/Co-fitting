'use strict';

// 規定文字数入力されたら次のフォームにフォーカスを移すユーザー補助
function nextField(str) {
    if (str.value.length >= str.maxLength) {
        for (var i = 0, elm = str.form.elements; i < elm.length; i++) {
            if (elm[i] == str) {
                // 50msの遅延を加えてフォーカスを移動(∵即時移動するとフォーカスが移動しないことがある)
                setTimeout(function() {
                    (elm[i + 1] || elm[0]).focus();
                }, 50);
                break;
            }
        }
    }
    return (str);
}

function darken_selected_button(LightButtonsClass, DarkButtonId){
    $(`.${LightButtonsClass}`).removeClass('selected-button');
    $(`#${DarkButtonId}`).addClass('selected-button');
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
    show(modalId) {
        $(`#${modalId}`).removeClass('modal-hidden').css('display', 'flex');
    },
    
    hide(modalId) {
        $(`#${modalId}`).addClass('modal-hidden');
    },
    
    createAndShow(modalId, title, content) {
        const modalHtml = `
            <div id="${modalId}" class="modal" style="display: flex;">
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
        
        $(`#${modalId}`).remove();  // 既存のモーダルがあれば削除しておく(∵同じIDのモーダルが複数表示されると正常に動作しない)
        $('body').append(modalHtml);
        
        return $(`#${modalId}`);
    },
    
    // 成功メッセージモーダルを表示
    showSuccess(message) {
        const content = `
            <p>${message}</p>
            <div class="modal-actions">
                <button type="button" class="btn btn-primary" data-modal-close>閉じる</button>
            </div>
        `;
        
        return this.createAndShow('success-modal', '成功', content);
    },
    
    // エラーメッセージモーダルを表示
    showError(message) {
        const content = `
            <p>${message}</p>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" data-modal-close>閉じる</button>
            </div>
        `;
        
        return this.createAndShow('error-modal', 'エラー', content);
    },
    
    // レシピ共有制限オーバー時のモーダルを表示
    // TODO: dataという引数は抽象的すぎて良くない。user等としたいがmessageがあるのでこれも難しい。よって呼び出し側の形式を見直してこれを解消したい。
    showShareLimit(data) {
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
            window.location.href = '/purchase/create_checkout_session/';
        });
        
        modal.find('#manage-shares-btn').on('click', () => {    
            this.hide('share-limit-modal');
            window.location.href = '/mypage/#shared-recipes';
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
        
        // 共有ボタンクリック時の処理
        modal.find('#confirm-share-btn').on('click', () => {
            const recipeName = modal.find('#recipe-name-input').val().trim();
            if (!recipeName) {
                alert('レシピ名を入力してください。');
                return;
            }
            this.hide('recipe-name-modal');
            onConfirm(recipeName);
        });
        
        // エンターキーでも共有ボタンクリックと同じ処理を行う
        modal.find('#recipe-name-input').on('keypress', (e) => {
            const isEnterKey = e.which === 13;
            if (isEnterKey) {
                modal.find('#confirm-share-btn').click();
            }
        });
        
        modal.find('#recipe-name-input').focus().select();
        
        return modal;
    }
};

// CSRFトークン取得の統一関数
function getCSRFToken() {
    // フォームから取得を試行
    const formToken = $('[name=csrfmiddlewaretoken]').val();
    if (formToken) return formToken;
    
    // Cookieから取得
    let cookieToken = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, 10) === 'csrftoken=') {
                cookieToken = decodeURIComponent(cookie.substring(10));
                break;
            }
        }
    }
    if (cookieToken) return cookieToken;

    console.warn('CSRF token not found in form or cookie');
    return null;
}

// モーダル全般に用いるイベントハンドラの設定
$(document).ready(function() {
    // 閉じるボタンのクリック（×ボタン）
    $(document).on('click', '.modal .close, [data-modal-close]', function() {
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
