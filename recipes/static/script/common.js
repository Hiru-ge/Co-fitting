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

// モーダルの表示・非表示を制御する関数
function showModal(modalId) {
    $(modalId).removeClass('modal-hidden');
}

function hideModal(modalId) {
    $(modalId).addClass('modal-hidden');
}