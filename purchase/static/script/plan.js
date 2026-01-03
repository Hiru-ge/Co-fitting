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

// CSRF トークン取得
function getCSRFToken() {
    return document.querySelector('[name=csrfmiddlewaretoken]')?.value ||
           document.cookie.split('; ')
               .find(row => row.startsWith('csrftoken='))
               ?.split('=')[1];
}

// 現在のプラン情報を取得
async function loadCurrentPlan() {
    try {
        const response = await fetch('/purchase/get_current_plan/');
        const data = await response.json();

        currentPlan = data.plan_type;

        // プラン名を表示
        const planNameElement = document.getElementById('current-plan-name');
        if (planNameElement) {
            // FREEプランの場合も適切に表示
            const planName = PLAN_INFO[currentPlan]?.name || (currentPlan === 'FREE' ? 'Free' : currentPlan);
            planNameElement.textContent = planName;
        }

        // 現在のプランカードを強調表示
        document.querySelectorAll('.plan-card').forEach(card => {
            card.classList.remove('current-plan');
            const planType = card.dataset.plan;
            const button = card.querySelector('.plan-button');

            if (planType === currentPlan) {
                card.classList.add('current-plan');
                button.textContent = '現在のプラン';
                button.disabled = true;
                // FREEプランの場合のみボタンを表示
                if (planType === 'FREE') {
                    button.style.display = 'block';
                }
            } else {
                button.textContent = 'このプランを選択';
                button.disabled = false;
                // FREEプラン以外の場合は常に表示
                if (planType !== 'FREE') {
                    button.style.display = 'block';
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
        const presetResponse = await fetch('/recipes/api/preset-recipes/');
        const presetData = await presetResponse.json();
        currentPresetCount = Array.isArray(presetData) ? presetData.length : 0;

        // 共有数を取得
        try {
            const sharedResponse = await fetch('/recipes/api/shared-recipes/');
            const sharedData = await sharedResponse.json();
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
    const modal = document.getElementById('upgrade-confirm-modal');
    const confirmBtn = document.getElementById('upgrade-confirm-btn');
    const planInfo = PLAN_INFO[newPlanType];

    // プラン名と料金を設定
    document.getElementById('upgrade-plan-name').textContent = `${planInfo.name}プランに変更`;
    document.getElementById('upgrade-price').textContent = `月額料金: ¥${planInfo.price}/月`;

    // 機能リストを生成
    const featuresList = document.getElementById('upgrade-features-list');
    featuresList.innerHTML = '';

    // 現在のプラン情報を取得（FREEプランの場合のデフォルト値）
    const currentPlanInfo = PLAN_INFO[currentPlan] || { presetLimit: 1, shareLimit: 1, hasPip: false };

    // プリセット枠
    const presetItem = document.createElement('li');
    presetItem.innerHTML = `<strong>プリセット枠:</strong> ${currentPlanInfo.presetLimit}枠 → <span class="highlight">${planInfo.presetLimit}枠</span>`;
    featuresList.appendChild(presetItem);

    // 共有枠
    const shareItem = document.createElement('li');
    shareItem.innerHTML = `<strong>共有枠:</strong> ${currentPlanInfo.shareLimit}枠 → <span class="highlight">${planInfo.shareLimit}枠</span>`;
    featuresList.appendChild(shareItem);

    // PiP機能
    const pipItem = document.createElement('li');
    const pipBefore = currentPlanInfo.hasPip ? 'あり' : 'なし';
    const pipAfter = planInfo.hasPip ? 'あり' : 'なし';
    const pipClass = planInfo.hasPip && !currentPlanInfo.hasPip ? 'highlight' : '';
    pipItem.innerHTML = `<strong>PiP機能:</strong> ${pipBefore} → <span class="${pipClass}">${pipAfter}</span>`;
    featuresList.appendChild(pipItem);

    confirmBtn.dataset.planType = newPlanType;
    modal.style.display = 'flex';
}

// ダウングレード警告モーダルを表示
function showDowngradeWarning(newPlanType) {
    const excess = calculateExcessData(newPlanType);
    const modal = document.getElementById('downgrade-warning-modal');
    const messageDiv = document.getElementById('downgrade-warning-message');
    const checkbox = document.getElementById('downgrade-agree-checkbox');
    const confirmBtn = document.getElementById('downgrade-confirm-btn');

    // 警告メッセージを構築
    let message = `<p><strong>${PLAN_INFO[newPlanType].name}プランへのダウングレードを実行しようとしています。</strong></p>`;
    message += '<p class="timing-notice">✓ 変更は即時反映されます</p>';

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

    messageDiv.innerHTML = message;

    // チェックボックスをリセット
    checkbox.checked = false;
    confirmBtn.disabled = true;

    // モーダル表示
    modal.style.display = 'flex';

    // 確認ボタンにプランタイプを保存
    confirmBtn.dataset.planType = newPlanType;
}

// 成功メッセージモーダルを表示
function showSuccess(message) {
    const modal = document.getElementById('success-modal');
    const messageElement = document.getElementById('success-message');
    messageElement.textContent = message;
    modal.style.display = 'flex';
}

// エラーメッセージモーダルを表示
function showError(message) {
    const modal = document.getElementById('error-modal');
    const messageElement = document.getElementById('error-message');
    messageElement.textContent = message;
    modal.style.display = 'flex';
}

// プラン変更を実行
async function executePlanChange(newPlanType) {
    const processingModal = document.getElementById('processing-modal');
    processingModal.style.display = 'flex';

    try {
        const response = await fetch('/purchase/change_plan/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({ plan_type: newPlanType })
        });

        const data = await response.json();

        // デバッグ用ログ
        console.log('Response status:', response.status);
        console.log('Response data:', data);

        processingModal.style.display = 'none';

        if (response.ok) {
            if (data.checkout_url) {
                // 新規チェックアウトセッションにリダイレクト
                window.location.href = data.checkout_url;
            } else {
                // プラン変更成功
                showSuccess(data.message || 'プランを変更しました。');
            }
        } else {
            // エラーレスポンスの詳細をログ出力
            console.error('プラン変更エラー:', data);
            showError(data.error || 'プラン変更に失敗しました。');
        }
    } catch (error) {
        processingModal.style.display = 'none';
        console.error('プラン変更エラー（例外）:', error);
        showError('プラン変更中にエラーが発生しました。');
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
document.addEventListener('DOMContentLoaded', async () => {
    // 現在のプラン情報を取得
    await loadCurrentPlan();
    await loadUserData();

    // プランボタンにイベントリスナーを追加
    document.querySelectorAll('.plan-button').forEach(button => {
        button.addEventListener('click', () => {
            const planType = button.dataset.planType;
            handlePlanButtonClick(planType);
        });
    });

    // ダウングレード確認モーダルのイベント設定
    const checkbox = document.getElementById('downgrade-agree-checkbox');
    const confirmBtn = document.getElementById('downgrade-confirm-btn');
    const cancelBtn = document.getElementById('downgrade-cancel-btn');
    const modal = document.getElementById('downgrade-warning-modal');

    if (checkbox) {
        checkbox.addEventListener('change', (e) => {
            confirmBtn.disabled = !e.target.checked;
        });
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            const planType = confirmBtn.dataset.planType;
            modal.style.display = 'none';
            executePlanChange(planType);
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // モーダル背景クリックで閉じる
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // アップグレード確認モーダルのイベント設定
    const upgradeModal = document.getElementById('upgrade-confirm-modal');
    const upgradeConfirmBtn = document.getElementById('upgrade-confirm-btn');
    const upgradeCancelBtn = document.getElementById('upgrade-cancel-btn');

    if (upgradeConfirmBtn) {
        upgradeConfirmBtn.addEventListener('click', () => {
            const planType = upgradeConfirmBtn.dataset.planType;
            upgradeModal.style.display = 'none';
            executePlanChange(planType);
        });
    }

    if (upgradeCancelBtn) {
        upgradeCancelBtn.addEventListener('click', () => {
            upgradeModal.style.display = 'none';
        });
    }

    upgradeModal?.addEventListener('click', (e) => {
        if (e.target === upgradeModal) {
            upgradeModal.style.display = 'none';
        }
    });

    // 成功モーダルのイベント設定
    const successModal = document.getElementById('success-modal');
    const successOkBtn = document.getElementById('success-ok-btn');

    if (successOkBtn) {
        successOkBtn.addEventListener('click', () => {
            successModal.style.display = 'none';
            window.location.reload(); // ページをリロードして最新状態を表示
        });
    }

    successModal?.addEventListener('click', (e) => {
        if (e.target === successModal) {
            successModal.style.display = 'none';
            window.location.reload();
        }
    });

    // エラーモーダルのイベント設定
    const errorModal = document.getElementById('error-modal');
    const errorOkBtn = document.getElementById('error-ok-btn');

    if (errorOkBtn) {
        errorOkBtn.addEventListener('click', () => {
            errorModal.style.display = 'none';
        });
    }

    errorModal?.addEventListener('click', (e) => {
        if (e.target === errorModal) {
            errorModal.style.display = 'none';
        }
    });
});
