'use strict';
$(document).ready(function() {
    // PiP用の非表示Video要素とCanvas要素を動的に生成
    const pipCanvas = document.createElement('canvas');
    pipCanvas.id = 'pip-canvas';
    pipCanvas.width = 350;
    pipCanvas.height = 200;
    // 画面内に置いて透明にする（iOSの描画停止回避）
    Object.assign(pipCanvas.style, { 
        position: 'fixed', 
        top: '0', 
        left: '0', 
        opacity: '0.01',        // 透明にする
        pointerEvents: 'none', // クリックを透過させる
        zIndex: '-100'       // 最背面に配置
    });
    document.body.appendChild(pipCanvas);

    const pipVideo = document.createElement('video');
    pipVideo.id = 'pip-video';
    pipVideo.muted = true;
    pipVideo.playsInline = true; // iOSで必須
    pipVideo.autoplay = true;
    // 修正: Video要素にもサイズを与えておく
    Object.assign(pipVideo.style, { 
        position: 'fixed', 
        top: '0', 
        left: '0', 
        width: '350px', // Canvasと同じサイズにしておく
        height: '200px',
        opacity: '0.01', // これも隠す
        pointerEvents: 'none',
        zIndex: '-100'
    });
    document.body.appendChild(pipVideo);

    // Canvasにレシピテーブルを描画する関数
    function drawRecipeToCanvas() {
        const ctx = pipCanvas.getContext('2d');
        const width = pipCanvas.width;
        const height = pipCanvas.height;

        // 背景塗りつぶし
        ctx.fillStyle = '#474747';
        ctx.fillRect(0, 0, width, height);

        // テキスト設定
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        
        ctx.font = '16px sans-serif';
        // テーブルヘッダー
        ctx.textAlign = 'left';
        ctx.fillText('経過時間', 20, 30);
        ctx.textAlign = 'right';
        ctx.fillText('総注湯量', width - 20, 30);

        // 区切り線
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(10, 40);
        ctx.lineTo(width - 10, 40);
        ctx.stroke();

        // データ行の描画
        const $recipeTable = $('.recipe-output');
        let yPos = 70;

        $recipeTable.find('tr').each(function(index) {
            if (index === 0) return; // ヘッダー行スキップ

            const $cols = $(this).find('td');
            if ($cols.length >= 3) {
                const time = $cols.eq(0).text().trim();
                const totalWater = $cols.eq(2).text().trim();

                ctx.textAlign = 'left';
                ctx.fillText(time, 20, yPos);
                
                ctx.textAlign = 'right';
                ctx.fillText(totalWater, width - 20, yPos);
                
                yPos += 30;
            }
        });
        
        // Canvasの内容変更を反映させるため、ダミーの矩形を描画して更新を通知する（iOS対策）
        ctx.fillStyle = 'rgba(0,0,0,0.01)';
        ctx.fillRect(0, 0, 1, 1);
    }

    // iOS対策: 無音の音声トラックを生成する関数
    function getSilentAudioTrack() {
        // AudioContextを作成（Webkitプレフィックスも考慮）
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        // 音源（オシレーター）を作成
        const oscillator = ctx.createOscillator();
        // ストリームの出力先を作成
        const dst = ctx.createMediaStreamDestination();
        
        // オシレーターを無音にして出力先に接続
        // (念のため周波数を0にしたりGainNodeで0にしても良いが、接続するだけでも機能することが多い)
        // ここではGainNodeを使って完全に無音化します
        const gainNode = ctx.createGain();
        gainNode.gain.value = 0; // 音量を0に
        
        oscillator.connect(gainNode);
        gainNode.connect(dst);
        
        oscillator.start();
        
        // ストリームから音声トラックを取り出す
        return dst.stream.getAudioTracks()[0];
    }

    const isSupportPiP = document.pictureInPictureEnabled || (pipVideo.webkitSupportsPresentationMode && typeof pipVideo.webkitSetPresentationMode === 'function');
    
    const isLoggedInFlag = document.getElementById('is-logged-in')?.dataset?.loggedIn === 'true';
    const isShowPiPButton = isSupportPiP && isLoggedInFlag;
    if (isShowPiPButton) {
        $.ajax({
            url: '/purchase/get_preset_limit/',
            method: 'GET',
            success: function(response) {
                if (response.preset_limit > 1) {
                    $('#pip-btn').show();
                    
                    $('#pip-btn').on('click', async function() {
                        console.log('PiPボタンが押されました。修正版コード実行中 v3');
                        const $recipeTable = $('.recipe-output');
                        
                        if ($recipeTable.length === 0 || $recipeTable.find('tr').length <= 1) {
                            alert('変換後レシピがありません。先にレシピを変換してください。');
                            return;
                        }

                        try {
                            drawRecipeToCanvas();
                            // Canvas更新ループを開始（iOS対策: ストリームを維持するため）
                            if (!window.pipAnimationLoopActive) {
                                window.pipAnimationLoopActive = true;
                                function loop() {
                                    const ctx = pipCanvas.getContext('2d');
                                    // 1x1ピクセルだけごく薄く塗り直して「動き」を作る
                                    ctx.fillStyle = 'rgba(0,0,0,0.01)';
                                    ctx.fillRect(0, 0, 1, 1);
                                    requestAnimationFrame(loop);
                                }
                                loop();
                            }

                            if (!pipVideo.srcObject) {
                                const stream = pipCanvas.captureStream(30); // 30fps
                                const audioTrack = getSilentAudioTrack();
                                stream.addTrack(audioTrack);
                                
                                pipVideo.srcObject = stream;
                            }

                            await pipVideo.play();
                            console.log('再生開始成功'); // ここまで来ていればplay()は成功している
                            drawRecipeToCanvas();

                            // 【変更点】iOS向けの webkitSetPresentationMode を先に試す
                            if (pipVideo.webkitSetPresentationMode) {
                                // iOS Safari用 (同期処理なのでawait不要)
                                pipVideo.webkitSetPresentationMode('picture-in-picture');
                            } else if (pipVideo.requestPictureInPicture) {
                                // PC Chrome/Edge用
                                await pipVideo.requestPictureInPicture();
                            }
                        } catch (error) {
                            console.error('PiPエラー名:', error.name);
                            console.error('PiPエラー詳細:', error.message);
                            
                            alert(`エラーが発生しました:\n${error.name}\n${error.message}`);
                        }
                    });
                }
            },
            error: function(xhr) {
                if (xhr.status === 401) {
                    return;
                }
                console.error('プレミアム状態の確認に失敗しました:', xhr);
            }
        });
    }
});