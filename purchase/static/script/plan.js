// プラン管理JavaScript

// グローバル変数
let currentPlan = null;
let currentPresetCount = 0;
let currentSharedCount = 0;

// プラン情報の定義（有料プランのみ）
const PLAN_INFO = {
    'BASIC': { name: 'Basic', presetLimit: 5, shareLimit: 5, price: 100, hasPip: false },
    'PREMIUM': { name: 'Premium', presetLimit: 10, shareLimit: 10, price: 200, hasPip: true },
    'UNLIMITED': { name: 'Unlimited', presetLimit: 100, shareLimit: 100, price: 500, hasPip: true }
};

// 現在のプラン情報を取得
async function loadCurrentPlan() {
    try {
        const data = await $.ajax({
            url: '/purchase/get_current_plan/',
            method: 'GET'
        });

        currentPlan = data.plan_type;

        // プラン名を表示
        const $planNameElement = $('#current-plan-name');
        if ($planNameElement.length) {
            // FREEプランの場合も適切に表示
            const planName = PLAN_INFO[currentPlan]?.name || (currentPlan === 'FREE' ? 'Free' : currentPlan);
            $planNameElement.text(planName);
        }

        // 現在のプランカードを強調表示
        $('.plan-card').each(function() {
            const $card = $(this);
            $card.removeClass('current-plan');
            const planType = $card.data('plan');
            const $button = $card.find('.plan-button');

            if (planType === currentPlan) {
                $card.addClass('current-plan');
                $button.text('現在のプラン');
                $button.prop('disabled', true);
                // FREEプランの場合のみボタンを表示
                if (planType === 'FREE') {
                    $button.show();
                }
            } else {
                $button.text('このプランを選択');
                $button.prop('disabled', false);
                // FREEプラン以外の場合は常に表示
                if (planType !== 'FREE') {
                    $button.show();
                }
            }
        });

        return data;
    } catch (error) {
        console.error('プラン情報の取得に失敗:', error);
        return null;
    }
}

// プリセット・共有数を取得
async function loadUserData() {
    try {
        // プリセット数を取得
        const presetData = await $.ajax({
            url: '/recipes/api/preset-recipes/',
            method: 'GET'
        });
        currentPresetCount = Array.isArray(presetData) ? presetData.length : 0;

        // 共有数を取得
        try {
            const sharedData = await $.ajax({
                url: '/recipes/api/shared-recipes/',
                method: 'GET'
            });
            currentSharedCount = Array.isArray(sharedData) ? sharedData.length : 0;
        } catch {
            // 共有レシピAPIがエラーの場合は0とする
            currentSharedCount = 0;
        }

    } catch (error) {
        console.error('ユーザーデータの取得に失敗:', error);
    }
}

// ダウングレードかどうかを判定（有料プランのみ）
function isDowngrade(newPlanType) {
    const planOrder = ['BASIC', 'PREMIUM', 'UNLIMITED'];
    const currentIndex = planOrder.indexOf(currentPlan);
    const newIndex = planOrder.indexOf(newPlanType);

    // 現在のプランがFREEの場合、ダウングレードではない
    if (currentPlan === 'FREE') {
        return false;
    }

    return newIndex < currentIndex;
}

// 超過データの計算
function calculateExcessData(newPlanType) {
    const newPlanInfo = PLAN_INFO[newPlanType];
    if (!newPlanInfo) {
        return { presets: 0, shared: 0, hasExcess: false };
    }

    const excessPresets = Math.max(0, currentPresetCount - newPlanInfo.presetLimit);
    const excessShared = Math.max(0, currentSharedCount - newPlanInfo.shareLimit);

    return {
        presets: excessPresets,
        shared: excessShared,
        hasExcess: excessPresets > 0 || excessShared > 0
    };
}

// アップグレード確認モーダルを表示
function showUpgradeConfirm(newPlanType) {
    const $modal = $('#upgrade-confirm-modal');
    const $confirmBtn = $('#upgrade-confirm-btn');
    const planInfo = PLAN_INFO[newPlanType];

    // プラン名と料金を設定
    $('#upgrade-plan-name').text(`${planInfo.name}プランに変更`);
    $('#upgrade-price').text(`月額料金: ¥${planInfo.price}/月`);

    // 機能リストを生成
    const $featuresList = $('#upgrade-features-list');
    $featuresList.empty();

    // 現在のプラン情報を取得（FREEプランの場合のデフォルト値）
    const currentPlanInfo = PLAN_INFO[currentPlan] || { presetLimit: 1, shareLimit: 1, hasPip: false };

    // プリセット枠
    const $presetItem = $('<li>');
    $presetItem.html(`<strong>プリセット枠:</strong> ${currentPlanInfo.presetLimit}枠 → <span class="highlight">${planInfo.presetLimit}枠</span>`);
    $featuresList.append($presetItem);

    // 共有枠
    const $shareItem = $('<li>');
    $shareItem.html(`<strong>共有枠:</strong> ${currentPlanInfo.shareLimit}枠 → <span class="highlight">${planInfo.shareLimit}枠</span>`);
    $featuresList.append($shareItem);

    // PiP機能
    const $pipItem = $('<li>');
    const pipBefore = currentPlanInfo.hasPip ? 'あり' : 'なし';
    const pipAfter = planInfo.hasPip ? 'あり' : 'なし';
    const pipClass = planInfo.hasPip && !currentPlanInfo.hasPip ? 'highlight' : '';
    $pipItem.html(`<strong>PiP機能:</strong> ${pipBefore} → <span class="${pipClass}">${pipAfter}</span>`);
    $featuresList.append($pipItem);

    $confirmBtn.data('plan-type', newPlanType);
    $modal.css('display', 'flex');
}

// ダウングレード警告モーダルを表示
function showDowngradeWarning(newPlanType) {
    const excess = calculateExcessData(newPlanType);
    const $modal = $('#downgrade-warning-modal');
    const $messageDiv = $('#downgrade-warning-message');
    const $checkbox = $('#downgrade-agree-checkbox');
    const $confirmBtn = $('#downgrade-confirm-btn');

    // 警告メッセージを構築
    let message = `<p><strong>${PLAN_INFO[newPlanType].name}プランへのダウングレードを実行しようとしています。</strong></p>`;
    message += '<p class="timing-notice">✓ 変更は即時反映されます</p>';
    message += '<p class="refund-notice">✓ ダウングレード時、現在のプランの未使用分は返金されません</p>';

    if (excess.hasExcess) {
        message += '<p>以下のデータが<strong>永久に削除</strong>されます：</p><ul>';
        if (excess.presets > 0) {
            message += `<li>プリセットレシピ: <strong>${excess.presets}件</strong>（古い順に削除）</li>`;
        }
        if (excess.shared > 0) {
            message += `<li>共有レシピ: <strong>${excess.shared}件</strong>（古い順に削除）</li>`;
        }
        message += '</ul>';
        message += '<p class="warning-note">削除されたレシピは復元できません。重要なレシピは事前に手動で削除することをお勧めします。</p>';
    } else {
        message += '<p>現在の登録レシピ数はプラン上限内のため、レシピ削除は発生しません。</p>';
    }

    $messageDiv.html(message);

    // チェックボックスをリセット
    $checkbox.prop('checked', false);
    $confirmBtn.prop('disabled', true);

    // モーダル表示
    $modal.css('display', 'flex');

    // 確認ボタンにプランタイプを保存
    $confirmBtn.data('plan-type', newPlanType);
}

// 成功メッセージモーダルを表示
function showSuccess(message) {
    const $modal = $('#success-modal');
    const $messageElement = $('#success-message');
    $messageElement.text(message);
    $modal.css('display', 'flex');
}

// エラーメッセージモーダルを表示
function showError(message) {
    const $modal = $('#error-modal');
    const $messageElement = $('#error-message');
    $messageElement.text(message);
    $modal.css('display', 'flex');
}

// プラン変更を実行
async function executePlanChange(newPlanType) {
    const $processingModal = $('#processing-modal');
    $processingModal.css('display', 'flex');

    try {
        const data = await $.ajax({
            url: '/purchase/change_plan/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            data: JSON.stringify({ plan_type: newPlanType }),
            dataType: 'json'
        });

        // デバッグ用ログ
        console.log('Response data:', data);

        $processingModal.css('display', 'none');

        if (data.checkout_url) {
            // GA4カスタムイベント: checkout_start
            if (typeof gtag === 'function') {
                gtag('event', 'checkout_start', {
                    'plan': newPlanType
                });
            }

            // 新規チェックアウトセッションにリダイレクト
            window.location.href = data.checkout_url;
        } else {
            // プラン変更成功
            showSuccess(data.message || 'プランを変更しました。');
        }
    } catch (xhr) {
        $processingModal.css('display', 'none');

        // エラーレスポンスの詳細をログ出力
        console.error('プラン変更エラー:', xhr);
        const errorMessage = xhr.responseJSON?.error || 'プラン変更に失敗しました。';
        showError(errorMessage);
    }
}

// プランボタンのクリック処理
function handlePlanButtonClick(planType) {
    if (planType === currentPlan) {
        return; // 現在のプランは選択不可
    }

    // ダウングレードの場合は警告モーダルを表示
    if (isDowngrade(planType)) {
        showDowngradeWarning(planType);
    } else {
        // アップグレードの場合は確認モーダルを表示
        showUpgradeConfirm(planType);
    }
}

// 初期化処理
$(document).ready(async function() {
    // GA4カスタムイベント: plan_view
    if (typeof gtag === 'function') {
        gtag('event', 'plan_view');
    }

    // 現在のプラン情報を取得
    await loadCurrentPlan();
    await loadUserData();

    // プランボタンにイベントリスナーを追加
    $('.plan-button').on('click', function() {
        const planType = $(this).data('plan-type');
        handlePlanButtonClick(planType);
    });

    // ダウングレード確認モーダルのイベント設定
    const $checkbox = $('#downgrade-agree-checkbox');
    const $confirmBtn = $('#downgrade-confirm-btn');
    const $cancelBtn = $('#downgrade-cancel-btn');
    const $modal = $('#downgrade-warning-modal');

    if ($checkbox.length) {
        $checkbox.on('change', function() {
            $confirmBtn.prop('disabled', !$(this).prop('checked'));
        });
    }

    if ($confirmBtn.length) {
        $confirmBtn.on('click', function() {
            const planType = $(this).data('plan-type');
            $modal.css('display', 'none');
            executePlanChange(planType);
        });
    }

    if ($cancelBtn.length) {
        $cancelBtn.on('click', function() {
            $modal.css('display', 'none');
        });
    }

    // モーダル背景クリックで閉じる
    $modal.on('click', function(e) {
        if (e.target === this) {
            $(this).css('display', 'none');
        }
    });

    // アップグレード確認モーダルのイベント設定
    const $upgradeModal = $('#upgrade-confirm-modal');
    const $upgradeConfirmBtn = $('#upgrade-confirm-btn');
    const $upgradeCancelBtn = $('#upgrade-cancel-btn');

    if ($upgradeConfirmBtn.length) {
        $upgradeConfirmBtn.on('click', function() {
            const planType = $(this).data('plan-type');
            $upgradeModal.css('display', 'none');
            executePlanChange(planType);
        });
    }

    if ($upgradeCancelBtn.length) {
        $upgradeCancelBtn.on('click', function() {
            $upgradeModal.css('display', 'none');
        });
    }

    $upgradeModal.on('click', function(e) {
        if (e.target === this) {
            $(this).css('display', 'none');
        }
    });

    // 成功モーダルのイベント設定
    const $successModal = $('#success-modal');
    const $successOkBtn = $('#success-ok-btn');

    if ($successOkBtn.length) {
        $successOkBtn.on('click', function() {
            $successModal.css('display', 'none');
            window.location.reload(); // ページをリロードして最新状態を表示
        });
    }

    $successModal.on('click', function(e) {
        if (e.target === this) {
            $(this).css('display', 'none');
            window.location.reload();
        }
    });

    // エラーモーダルのイベント設定
    const $errorModal = $('#error-modal');
    const $errorOkBtn = $('#error-ok-btn');

    if ($errorOkBtn.length) {
        $errorOkBtn.on('click', function() {
            $errorModal.css('display', 'none');
        });
    }

    $errorModal.on('click', function(e) {
        if (e.target === this) {
            $(this).css('display', 'none');
        }
    });

    // 契約状況確認・解約ボタンのイベント設定
    $('#subscription-status-btn').on('click', function() {
        const subscriptionStatus = $(this).data('subscription-status');
        if (subscriptionStatus === '未契約') {
            // 未契約の場合はプラン選択を促すメッセージ
            showError('サブスクリプションを契約していません。上記からプランを選択してください。');
        } else {
            // 契約済みの場合はカスタマーポータルに遷移
            window.location.href = '/purchase/create_portal_session/';
        }
    });

    // サブスクリプションポータルボタン（成功モーダル内のボタン）
    $('#portal-session-btn').on('click', function() {
        window.location.href = '/purchase/create_portal_session/';
    });
});
