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
        updateTotalOutput();
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

    // 元レシピの比率計算(変換後レシピと元レシピの比率を揃える用にこれがあると便利かも)
    $('.origin-process, #ice_g, #bean-input').on('change', function(){
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
        }
    });

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

    // トグル機能
    $('.accordion-item').hide();
    $('.accordion-head').on('click', function() {
        $(this).children('.accordion-toggle').toggleClass('rotate-90');
        $(this).next().children('.accordion-item').slideToggle(300);
    });
});