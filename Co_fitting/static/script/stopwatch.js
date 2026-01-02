'use strict';
$(document).ready(function() {
    // ストップウォッチ機能
    const Time = document.getElementById('time');
    const StartButton = document.getElementById('start');
    const StopButton = document.getElementById('stop');
    const ResetButton = document.getElementById('reset');
    
    // タイマー要素が存在しない場合は処理をスキップ
    if (!StartButton || !StopButton || !ResetButton || !Time) {
        return;
    }

    let startTime;
    let stopTime = 0;
    let timeoutID;
    
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
        darken_selected_button('timer-button', StartButton.id);
        
        startTime = Date.now();
        displayTime();
    });
    
    // ストップボタンがクリックされたら時間を止める
    $(`#${StopButton.id}`).on('click', function() {
        StartButton.disabled = false;
        StopButton.disabled = true;
        ResetButton.disabled = false;
        darken_selected_button('timer-button', StopButton.id);

        clearTimeout(timeoutID);
        stopTime += (Date.now() - startTime);
    });
    
    // リセットボタンがクリックされたら時間を0に戻す
    $(`#${ResetButton.id}`).on('click', function() {
        StartButton.disabled = false;
        StopButton.disabled = true;
        ResetButton.disabled = true;
        darken_selected_button('timer-button', ResetButton.id);
        Time.textContent = '00:00';
        stopTime = 0;
    });
});