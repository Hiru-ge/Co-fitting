'use strict';
$(document).ready(function() {
    function iceModeApply(isIce, ice_gFromDB){
            // 当初は.show()と.hide()で表示を切り替えていたが、フォームの自動フォーカスが効かなくなるため、html()で中身を書き換えることにした
            let iceInputDivText= `
            <label for="ice_g">レシピの氷量(g): </label>
            <input type="number" id="ice_g" class="wide-input" name="ice_g" maxlength="3" onkeyup="nextField(this)"> g
        `;
        if(isIce==true){
            $('.ice_g-div').html(iceInputDivText);
            $('.ice-mode-show').show();
            $('html, header, footer').addClass('ice-mode'); // アイスモード時のスタイル変更用
            if(ice_gFromDB!=null){        
                // マイプリセット編集画面でDBから氷量が渡された場合、氷量は入力欄確保後に明示的に格納(そうしないとvalueを格納できなかった)
                $('#ice_g').val(ice_gFromDB); 
            }
        }else{
            $('.ice_g-div').html('');
            $('.ice-mode-show').hide();
            $('html, header, footer').removeClass('ice-mode');  // アイスモード時のスタイル変更用
        }
    }

    // アイスモードの切り替え(チェックボックスのON/OFFで表示を切り替える)
    $('#ice-check, #is_ice').on('change', function(){
        iceModeApply(this.checked, /*ice_gFromDB=*/null)
    });

    // ページロード時にアイスモードをチェック
    if ($('#is_ice').prop('checked')) {
        iceModeApply(true, ice_gFromDB)
    }

    function originRecipeFormLengthAdjuster(InputPourTimes, CurrentPourTimes){
        if (InputPourTimes > CurrentPourTimes) {
            for (let i = CurrentPourTimes; i < InputPourTimes; i++) {                
                let processInput = `
                    <div class="pour-step${i + 1}">
                        <label>${i + 1}投目</label>
                        <input type="number" class="minutes" name="step${i + 1}_minute" min="0" max="59"   maxlength="1" onkeyup="nextField(this)" required>:<input type="number" class="seconds" name="step${i + 1}_second" min="0" max="59" maxlength="2" onkeyup="nextField(this)" required>
                        <input type="number" class="pour-ml wide-input" name="step${i + 1}_water" min="1"  maxlength="3" onkeyup="nextField(this)" required> ml
                    </div>`
                    ;
                $('.origin-process').append(processInput);
            }
        } else if (InputPourTimes < CurrentPourTimes) {
            for (let i = CurrentPourTimes; i > InputPourTimes && i > 1; i--) { // i>1 : 1投目は消さない
                $(`.pour-step${i}`).remove();
            }
        }
    }

    function selectedButtonDarkener(LightButtonsClass, DarkButtonId){
        $(`.${LightButtonsClass}`).removeClass('selected-button');
        $(`#${DarkButtonId}`).addClass('selected-button');
    }

    function presetActivate(recipe){
        $('#pour-times-input').val(recipe.len_steps);
        const InputPourTimes = $('#pour-times-input').val();
        const CurrentPourTimes = $('.origin-process').children().length;
        originRecipeFormLengthAdjuster(InputPourTimes, CurrentPourTimes);

        $('#ice-check').prop('checked', recipe.is_ice).change();
        $('#ice_g').val(recipe.ice_g)
        $('#bean-input').val(recipe.bean_g);

        recipe.steps.forEach(step => {
            $(`.pour-step${step.step_number} .minutes`).val(String(step.minute));
            $(`.pour-step${step.step_number} .seconds`).val(String(step.seconds).padStart(2, '0'));
            $(`.pour-step${step.step_number} .pour-ml`).val(String(step.total_water_ml_this_step).padStart(2, '0'));
        });

        let selectedRecipeSumWater;
        if (recipe.ice_g) {
            selectedRecipeSumWater = Number(recipe.water_ml) + Number(recipe.ice_g);
        } else {
            selectedRecipeSumWater = recipe.water_ml;
        }
        const OriginRatio = brewParameterCompleter([recipe.bean_g, selectedRecipeSumWater, '']);
        $('#origin-ratio').html(OriginRatio);
        $('#ratio-target').val(OriginRatio);    // ターゲット比率を自動転記
        updateTotalOutput();
        
        // メモを表示
        displayMemo(recipe.memo);
    }

    function getPresetRecipeData(presetId) {
        const DefaultPresetRecipesJSON = JSON.parse($('#default_preset_recipes').text());
        const UsersPresetRecipesJSON = JSON.parse($('#users_preset_recipes').text());
        const PresetRecipesJSON = DefaultPresetRecipesJSON.concat(UsersPresetRecipesJSON);
        for (var i = 0; i < PresetRecipesJSON.length; i++) {
            if (PresetRecipesJSON[i].id == presetId) {
                return PresetRecipesJSON[i];
            }
        }
        return null;
    }

    // メモ表示関数
    function displayMemo(memo) {
        if (memo && memo.trim() !== '') {
            $('#origin-memo-text').text(memo);
            $('#converted-memo-text').text(memo);
            $('.memo-section').show();
        } else {
            $('#origin-memo-text').text('');
            $('#converted-memo-text').text('');
            $('.memo-section').hide();
        }
    }

    $('.preset-button').on('click', function() {
        const presetId = $(this).attr('id');
        const recipe = getPresetRecipeData(presetId);
        selectedButtonDarkener('preset-button', presetId);
        presetActivate(recipe);
    });

    // レシピ入力欄の出力
    $('#pour-times-input').on('change', function(){
        const InputPourTimes = $('#pour-times-input').val();
        const CurrentPourTimes = $('.origin-process').children().length;
        originRecipeFormLengthAdjuster(InputPourTimes, CurrentPourTimes);
    });

    // 変換前レシピの入力補助
    // 入力補助関数(豆量, 総湯量, 比率): 引数を2つ渡すと、残りの1つを計算して返す
        // 配列として渡すことで、渡したい引数だけを明示的に指定できる(「総湯量は渡さない」のようなこともできるはず)
    function brewParameterCompleter([bean_g, water_ml, ratio]) {
        if(bean_g && water_ml){
            ratio = (water_ml / bean_g).toFixed(1);
            return ratio;
        }else if(bean_g && ratio){
            water_ml = (bean_g * ratio).toFixed(1);
            return water_ml;
        }else if(water_ml && ratio){
            bean_g = (water_ml / ratio).toFixed(1);
            return bean_g;
        }else{
            console.log('Error[brewParameterCompleter]: 引数が不足しています');
        }
    }

    // 元レシピの比率計算とターゲット比率の自動転記を行う関数
    function updateOriginRatio() {
        updateTotalOutput();
        const PourTimes = $('#pour-times-input').val();
        const OriginSumWater = $(`.pour-step${PourTimes}`).children('.pour-ml').val();
        let isIceMode = $('#ice-check').prop('checked');
        if(isIceMode){
            OriginSumWater = Number(OriginSumWater) + Number($('#ice_g').val());
        }
        const OriginBean = $('#bean-input').val();
        if (OriginBean && OriginSumWater) {
            const OriginRatio = brewParameterCompleter([/*豆量=*/OriginBean, /*総湯量=*/OriginSumWater, /*比率=*/'']);
            $('#origin-ratio').html(OriginRatio);
            $('#ratio-target').val(OriginRatio);    // ターゲット比率を自動転記
        }
    }

    // 元レシピ内のinputは動的に生成されるため、イベント委譲で動的にバインドする必要がある
    $('.origin-process').on('change', 'input', updateOriginRatio);
    $('#ice_g, #bean-input').on('change', updateOriginRatio);

    function updateTotalOutput() {
        const PourTimes = $('#pour-times-input').val();
        let OriginSumWater = 0;
        if (PourTimes) {
            OriginSumWater = Number($(`.pour-step${PourTimes}`).children('.pour-ml').val());
        }
        let ice_g = 0;
        let isIceMode = $('html').hasClass('ice-mode');
        if(isIceMode){
            ice_g = Number($('#ice_g').val());
        }
        const totalOutput = OriginSumWater + ice_g;
        $('.origin-total-output').html(totalOutput);

        // 変換後レシピの出来上がり量も更新
        const convertedWaterTotal_ml = Number($('.water-output').html());
        const convertedIce_g = Number($('.ice-output').html());
        if (isIceMode) {
            $('.converted-total-output').html(convertedWaterTotal_ml + convertedIce_g);
        } else {
            $('.converted-total-output').html(convertedWaterTotal_ml);
        }
    }

    // 変換目標入力欄の入力補助(豆量･総湯量･比率のどれか2つを入力すると、残り1つを計算して補完する)
    $('.targetBrewParameter').on('change', function(){
        let targetBean = $('#bean-target').val();
        let targetWater = $('#water-target').val();
        let targetRatio = $('#ratio-target').val();
        if (!targetBean){
            targetBean = brewParameterCompleter(['', targetWater, targetRatio]);
            $('#bean-target').val(targetBean);
        }else if (!targetWater){
            targetWater = brewParameterCompleter([targetBean, '', targetRatio]);
            $('#water-target').val(targetWater);
        }else if (!targetRatio){
            targetRatio = brewParameterCompleter([targetBean, targetWater, '']);
            $('#ratio-target').val(targetRatio);
        // これ以降はエラー検知
        }else if(targetBean && targetWater && targetRatio){
            console.log('Error[変換目標入力補助]: 入力項目が多すぎます');
        }else{
            console.log('Error[変換目標入力補助]: 入力項目が不足しています');
        }
    });

    // 変換目標入力欄のクリア
    $('.clear-button').on('click', function(){
        event.preventDefault(); // ページ遷移を防ぐ
        $('#bean-target, #water-target, #ratio-target').val('');
    });

    // 共有ボタンの機能
    $('#share-recipe-btn').on('click', function() {
        const isLoggedIn = window.isLoggedIn;
        if (!isLoggedIn) {
            showLoginPrompt();
            return;
        }

        // 変換後レシピが存在するかチェック
        const hasConvertedRecipe = $('.bean-output').text().trim() !== '';
        if (!hasConvertedRecipe) {
            alert('変換後レシピがありません。先にレシピを変換してください。');
            return;
        }

        // レシピ名入力モーダルを表示
        showRecipeNameModal();
    });

    function showLoginPrompt() {
        const message = '共有機能はログインユーザー限定機能です！\n新規登録・ログインしていきませんか？';
        if (confirm(message)) {
            window.location.href = '/users/login';  // ログインページにリダイレクト
        }
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

    // レシピ名入力モーダル表示
    function showRecipeNameModal() {
        // モーダルが既に存在する場合は削除
        $('#recipe-name-modal').remove();
        
        const modalHtml = `
            <div id="recipe-name-modal" class="modal" style="display: block;">
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-title">
                            <h3>レシピ名を入力</h3>
                        </div>
                        <span class="close" id="close-recipe-name-modal">&times;</span>
                    </div>
                    <div class="modal-body">
                        <p>共有するレシピの名前を入力してください。</p>
                        <input type="text" id="recipe-name-input" class="wide-input" placeholder="レシピ名を入力" maxlength="30" value="共有レシピ">
                        <div class="modal-actions">
                            <button id="confirm-share-btn" class="btn btn-primary">共有する</button>
                            <button id="cancel-share-btn" class="btn btn-secondary">キャンセル</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        $('body').append(modalHtml);
        
        // イベント設定
        $('#close-recipe-name-modal, #cancel-share-btn').on('click', function() {
            $('#recipe-name-modal').remove();
        });
        
        $('#confirm-share-btn').on('click', function() {
            const recipeName = $('#recipe-name-input').val().trim();
            if (!recipeName) {
                alert('レシピ名を入力してください。');
                return;
            }
            $('#recipe-name-modal').remove();
            shareRecipe(recipeName);
        });
        
        // モーダル外クリックで閉じる
        $('#recipe-name-modal').on('click', function(e) {
            if (e.target === this) {
                $(this).remove();
            }
        });
        
        // エンターキーで確定
        $('#recipe-name-input').on('keypress', function(e) {
            if (e.which === 13) { // Enter key
                $('#confirm-share-btn').click();
            }
        });
        
        // フォーカス
        $('#recipe-name-input').focus().select();
    }

    function shareRecipe(recipeName) {
        $('#share-recipe-btn').prop('disabled', true);
        
        // 変換後レシピのデータを収集
        const recipeData = {
            name: recipeName,
            bean_g: parseFloat($('.bean-output').text()),
            water_ml: parseFloat($('.water-output').text()),
            is_ice: $('html').hasClass('ice-mode'),
            ice_g: parseFloat($('.ice-output').text()) || 0,
            len_steps: parseInt($('#pour-times-input').val()),
            steps: []
        };

        // 変換後レシピ欄（.recipe-outputテーブル）からステップ情報を取得
        // テーブルのtr（1行目はヘッダーなので除外）
        const $rows = $('.recipe-output tr').not(':first');
        let cumulative = 0;
        $rows.each(function(index) {
            const $cols = $(this).find('td');
            if ($cols.length < 3) return; // 安全対策
            // 時間
            const timeParts = $cols.eq(0).text().split(':');
            const minute = parseInt(timeParts[0], 10);
            const seconds = parseInt(timeParts[1], 10);
            // 注湯量
            const pour_ml = parseFloat($cols.eq(1).text());
            // 総注湯量
            const cumulative_water_ml = parseFloat($cols.eq(2).text());
            recipeData.steps.push({
                step_number: index + 1,
                minute: minute,
                seconds: seconds,
                total_water_ml_this_step: pour_ml,
                cumulative_water_ml: cumulative_water_ml
            });
        });

        // バックエンドAPIに送信
        $.ajax({
            url: '/api/shared-recipes/create/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            data: JSON.stringify(recipeData),
            success: function(response) {
                // SNSシェア用URLを /share/<token>/ 形式に変換
                const shareUrl = `/share/${response.access_token}/`;
                shareToSocialMedia(shareUrl, recipeData);
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
            },
            complete: function() {
                $('#share-recipe-btn').prop('disabled', false);
            }
        });
    }

    // 共有制限オーバー時のモーダル表示
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
                    <button id="subscribe-btn" class="btn btn-primary">サブスクリプション契約</button>
                    <button id="manage-shares-btn" class="btn btn-secondary">共有レシピ管理</button>
                    <button id="close-share-limit-btn" class="btn btn-secondary">閉じる</button>
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
            window.location.href = '/mypage#shared-recipes';
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
            text: `Co-fittingからレシピを共有しました! #Cofitting`,
            url: shareUrl
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                // ユーザーがキャンセルした場合やエラーの場合
                fallbackToClipboard(shareUrl);
            }
        } else {
            // Web Share API非対応ブラウザ
            fallbackToClipboard(shareUrl);
        }
    }

    // フォールバック: クリップボードにコピー
    function fallbackToClipboard(shareUrl) {
        navigator.clipboard.writeText(shareUrl).then(function() {
            alert('共有URLがクリップボードにコピーされました！\n\n' + shareUrl);
        }).catch(function(err) {
            alert('共有URLのコピーに失敗しました。\n\n' + shareUrl);
        });
    }


    function inputError_Detector([pourTimes, originSumWater, targetBean, targetWater]) {
        let defaultMessage = '【入力不備】\n'; // エラーメッセージの初期値(エラーが検知されるとこれに追加されていく)
        let errorMassage = defaultMessage;
        if (!pourTimes){
            errorMassage += '･変換前投数\n';
        }
        if (!originSumWater){
            errorMassage += '･変換前レシピ\n';
        }
        if (!targetBean){
            errorMassage += '･変換前豆量\n';
        }
        if (!targetWater){
            errorMassage += '･変換前総湯量\n';
        }

        if(errorMassage !== defaultMessage){
            window.alert(errorMassage);
            return 'Error';
        }
    }

    function recipeConverter(pourTimes, convertRate, isShowPercentage = false) {
        const DefaultOutput = `
            <tr>
                <th>経過時間</th>
                <th>注湯量</th>
                <th>総注湯量</th>
                ${isShowPercentage ? '<th>%</th>' : ''}
            </tr>
        `;
        let Output = DefaultOutput;
        let totalWater_mls=[0], minutes=["0"], seconds=["00"], input_pour_mls=[0],convertedPour_mls=[0];
        for(let i = 1; i <= pourTimes; i++){
            minutes.push(String($(`.pour-step${i}`).children('.minutes').val()).padStart(2, '0'));
            seconds.push(String($(`.pour-step${i}`).children('.seconds').val()).padStart(2, '0'));
            input_pour_mls.push($(`.pour-step${i}`).children('.pour-ml').val());
            totalWater_mls.push(Math.trunc(input_pour_mls[i] * convertRate));

            // 各投での注湯量を計算(総湯量 - ひとつ前の総湯量)
            convertedPour_mls.push(Math.trunc(totalWater_mls[i] - totalWater_mls[i-1]));
        }

        for (let i = 1; i <= pourTimes; i++) {
            let percentage = Math.trunc(((totalWater_mls[i]/totalWater_mls[pourTimes])*100));
            Output += `
                <tr>
                    <td>${minutes[i]}:${seconds[i]}</td>
                    <td>${convertedPour_mls[i]} ml</td>
                    <td>${totalWater_mls[i]} ml</td>
                    ${isShowPercentage ? `<td>${percentage} %</td>` : ''}
                </tr>
            `;
        }
        updateTotalOutput();

        return Output;
    }

    // 変換に必要なパラメータを収集する関数
    function collectConversionParameters() {
        // 投数を取得
        let pourTimes = $('#pour-times-input').val();
        let originWaterTotal_ml = $(`.pour-step${pourTimes}`).children('.pour-ml').val();
        let ice_g = 0;  // ice_gの初期値は0としてNanを防ぎ、ice-modeなら正しい値で更新する
        if($('#ice-check').prop('checked')){
            ice_g = $('#ice_g').val();
        }

        let targetBean_g, targetWaterTotal_ml, convertRate;
        if($('#magnification').val()){ // 変換率が手動入力されている場合は、それを採用して変換する
            convertRate = $('#magnification').val();
            targetBean_g = $('#bean-input').val()*convertRate;
            targetWaterTotal_ml = originWaterTotal_ml*convertRate;
        }else{        
            targetBean_g = $('#bean-target').val();
            targetWaterTotal_ml = $('#water-target').val();
            // 文字列に解釈されないよう、Number()で明示的に数値に変換
            convertRate = targetWaterTotal_ml / (Number(originWaterTotal_ml) + Number(ice_g));  
        }
        updateTotalOutput();
        // 入力エラー検知関数に処理を投げて、エラーがあればアラートを出して処理を中断
        if(inputError_Detector([pourTimes, originWaterTotal_ml, targetBean_g, targetWaterTotal_ml])=='Error'){
            return;
        }
        return [pourTimes, originWaterTotal_ml, ice_g, targetBean_g, convertRate];
    }

    // レシピの変換･変換後レシピの出力
    $('.convert-button').on('click', function(){
        event.preventDefault(); // ページ遷移を防ぐ

        // 変換前レシピの入力内容をモードに応じて取得
        let [pourTimes, originWaterTotal_ml, ice_g, targetBean_g, convertRate] = collectConversionParameters();

        // 変換後の豆量と総湯量を転記(小数点第一位まで表示)
        $('.bean-output').text(Math.trunc(targetBean_g*10)/10);
        $('.water-output').text(Math.trunc((originWaterTotal_ml*convertRate)*10)/10);
        // 氷量が入力されている(アイスモードの)場合、変換後の氷量を算出・出力
        let isIceMode = $('html').hasClass('ice-mode');
        if(isIceMode){
            let convertedIce_g = Math.trunc(ice_g*convertRate);
            $('.ice-output').text(convertedIce_g);
        }

        // 変換後のレシピを算出・出力
        const isShowPercentage = $('#percentage-check').prop('checked');
        const ConvertedRecipe = recipeConverter(pourTimes, convertRate, isShowPercentage);
        $('.recipe-output').html(ConvertedRecipe);
        
        // 変換後レシピのメモも表示（元レシピのメモと同じ内容）
        const originMemo = $('#origin-memo-text').text();
        if (originMemo && originMemo.trim() !== '') {
            $('#converted-memo-text').text(originMemo);
            $('.memo-section').show();
        } else {
            $('#converted-memo-text').text('');
            $('.memo-section').hide();
        }

    });




    // ストップウォッチ機能
    const Time = document.getElementById('time');
    const StartButton = document.getElementById('start');
    const StopButton = document.getElementById('stop');
    const ResetButton = document.getElementById('reset');
    
    // 開始時間
    let startTime;
    // 停止時間
    let stopTime = 0;
    // タイムアウトID
    let timeoutID;
    
    // 時間を表示する関数
    function displayTime() {
        const CurrentTime = new Date(Date.now() - startTime + stopTime);
        const M = String(CurrentTime.getMinutes()).padStart(2, '0');
        const S = String(CurrentTime.getSeconds()).padStart(2, '0');
        
        Time.textContent = `${M}:${S}`;
        timeoutID = setTimeout(displayTime, 10);
    }
    
    // スタートボタンがクリックされたら時間を進める
    $(`#${StartButton.id}`).on('click', function() {
        StartButton.disabled = true;
        StopButton.disabled = false;
        ResetButton.disabled = true;
        // 選択中のボタンは暗くする
        selectedButtonDarkener('timer-button', StartButton.id);
        
        startTime = Date.now();
        displayTime();
    });
    
    // ストップボタンがクリックされたら時間を止める
    $(`#${StopButton.id}`).on('click', function() {
        StartButton.disabled = false;
        StopButton.disabled = true;
        ResetButton.disabled = false;
        selectedButtonDarkener('timer-button', StopButton.id);

        clearTimeout(timeoutID);
        stopTime += (Date.now() - startTime);
    });
    
    // リセットボタンがクリックされたら時間を0に戻す
    $(`#${ResetButton.id}`).on('click', function() {
        StartButton.disabled = false;
        StopButton.disabled = true;
        ResetButton.disabled = true;
        selectedButtonDarkener('timer-button', ResetButton.id);
        Time.textContent = '00:00';
        stopTime = 0;
    });

    // 共有レシピの処理
    function handleSharedRecipe() {
        let sharedRecipeData = null;
        const sharedRecipeScript = document.getElementById('shared_recipe_data');
        if (sharedRecipeScript) {
            try {
                sharedRecipeData = JSON.parse(sharedRecipeScript.textContent);
            } catch (e) {
                console.error('共有レシピデータのパースに失敗:', e);
            }
        }
        console.log('handleSharedRecipe:', sharedRecipeData);
        
        if (sharedRecipeData) {
            if (sharedRecipeData.error) {
                // エラーの場合
                showErrorModal(sharedRecipeData.message);
            } else {
                // 正常な共有レシピの場合
                showSharedRecipeModal(sharedRecipeData);
            }
        } else {
            console.log('共有レシピデータが存在しません。');
        }
    }

    // 共有レシピモーダル表示
    function showSharedRecipeModal(recipeData) {
        const modal = $('#shared-recipe-modal');
        const infoDiv = $('#shared-recipe-info');
        // レシピ情報を表示
        let html = `
            <div class="shared-recipe-details">
                <h3>${recipeData.name}</h3>
                <p><strong>豆量:</strong> <span>${recipeData.bean_g}g</span></p>
                <p><strong>総湯量:</strong> <span>${recipeData.water_ml}ml</span></p>
                ${recipeData.is_ice ? `<p><strong>氷量:</strong> <span>${recipeData.ice_g}g</span></p>` : ''}
                <p><strong>ステップ数:</strong> <span>${recipeData.len_steps}ステップ</span></p>
                ${recipeData.memo ? `<p><strong>メモ:</strong> <span>${recipeData.memo}</span></p>` : ''}
            </div>
        `;
        infoDiv.html(html);
        modal.show();
    }

    // プリセット追加処理
    function addSharedRecipeToPreset(token) {
        $('#add-to-preset-btn').prop('disabled', true).text('追加中...');
        
        $.ajax({
            url: `/api/shared-recipes/${token}/add-to-preset`,
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            success: function(response) {
                $('#shared-recipe-modal').hide();
                showSuccessModal(response.message);
                
                // プリセット情報を更新するため、変換ページにリダイレクト
                setTimeout(function() {
                    window.location.href = '/';
                }, 1500);
            },
            error: function(xhr) {
                let errorMessage = 'レシピの追加に失敗しました。';
                
                if (xhr.status === 401) {
                    const data = xhr.responseJSON;
                    if (data && data.error === 'authentication_required') {
                        errorMessage = data.message;
                    } else {
                        errorMessage = 'ログインが必要です。マイプリセットに追加するにはログインしてください。';
                    }
                    // ログインボタンを表示
                    $('#error-actions').show();
                } else if (xhr.status === 400) {
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
                $('#add-to-preset-btn').prop('disabled', false).html('追加');
            }
        });
    }

    // モーダル関連のイベント
    $('#add-to-preset-btn').on('click', function() {
        const sharedRecipeData = JSON.parse(document.getElementById('shared_recipe_data')?.textContent || 'null');
        if (sharedRecipeData && !sharedRecipeData.error) {
            addSharedRecipeToPreset(sharedRecipeData.access_token);
        }
    });

    $('#cancel-shared-btn').on('click', function() {
        $('#shared-recipe-modal').hide();
    });

    // ログインボタンのクリックイベント
    $('#login-redirect-btn').on('click', function() {
        window.location.href = '/users/login';
    });

    // 全共有レシピ削除ボタンのクリックイベント
    $('#delete-all-shared-btn').on('click', function() {
        deleteAllSharedRecipes();
    });

    // 全共有レシピ削除関数
    function deleteAllSharedRecipes() {
        $('#delete-all-shared-btn').prop('disabled', true).text('削除中...');
        
        $.ajax({
            url: '/api/shared-recipes/delete-all',
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            success: function(response) {
                $('#error-modal').hide();
                showSuccessModal(response.message);
            },
            error: function(xhr) {
                let errorMessage = '共有レシピの削除に失敗しました。';
                
                if (xhr.status === 401) {
                    errorMessage = 'ログインが必要です。';
                } else if (xhr.status === 500) {
                    const data = xhr.responseJSON;
                    errorMessage = data.message || 'サーバーエラーが発生しました。';
                }
                
                showErrorModal(errorMessage);
            },
            complete: function() {
                $('#delete-all-shared-btn').prop('disabled', false).text('現在有効な共有レシピを削除');
            }
        });
    }

    $('#close-shared-modal, #close-success-modal, #close-error-modal, #close-success-btn, #close-error-btn').on('click', function() {
        $(this).closest('.modal').hide();
        // エラーモーダルを閉じる際にボタンを非表示にする
        if ($(this).attr('id') === 'close-error-modal' || $(this).attr('id') === 'close-error-btn') {
            $('#error-actions').hide();
            $('#login-redirect-btn').hide();
            $('#delete-all-shared-btn').hide();
        }
    });

    // モーダル外クリックで閉じる
    $('.modal').on('click', function(e) {
        if (e.target === this) {
            $(this).hide();
            // エラーモーダルを閉じる際にボタンを非表示にする
            if ($(this).attr('id') === 'error-modal') {
                $('#error-actions').hide();
                $('#login-redirect-btn').hide();
                $('#delete-all-shared-btn').hide();
            }
        }
    });

    // 成功モーダル表示
    function showSuccessModal(message) {
        $('#success-message').text(message);
        $('#success-modal').show();
    }

    // エラーモーダル表示
    function showErrorModal(message, showDeleteButton = false) {
        $('#error-message').text(message);
        
        // ログインボタンと削除ボタンの表示制御
        if (message.includes('ログインが必要です')) {
            $('#login-redirect-btn').show();
            $('#delete-all-shared-btn').hide();
            $('#error-actions').show();
        } else if (showDeleteButton) {
            $('#login-redirect-btn').hide();
            $('#delete-all-shared-btn').show();
            $('#error-actions').show();
        } else {
            $('#error-actions').hide();
        }
        
        $('#error-modal').show();
    }

    // トグル機能
    $('.accordion-item').hide();
    $('.accordion-head').on('click', function() {
        $(this).children('.accordion-toggle').toggleClass('rotate-90');
        $(this).next().children('.accordion-item').slideToggle(300);
    });
    
    // メモ欄を初期状態で非表示にする
    $('.memo-section').hide();

    // 共有レシピの処理を実行
    handleSharedRecipe();
});