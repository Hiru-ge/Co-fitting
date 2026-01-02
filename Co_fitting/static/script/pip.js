'use strict';
$(document).ready(function() {
    // ========================================
    // 定数定義
    // ========================================

    const PIP_CONFIG = {
        CANVAS_WIDTH: 350,
        CANVAS_HEIGHT: 200,
        ELEMENT_OPACITY: '0.01',
        ELEMENT_Z_INDEX: '-100',
        STREAM_FPS: 30,
        BACKGROUND_COLOR: '#474747',
        TEXT_COLOR: '#ffffff',
        HEADER_FONT: '16px sans-serif',
        PADDING_X: 20,
        HEADER_Y: 30,
        DIVIDER_Y: 40,
        DATA_START_Y: 70,
        ROW_HEIGHT: 30,
        PREMIUM_PRESET_LIMIT: 1 // この値より大きければプレミアム
    };

    // ========================================
    // ユーティリティ関数
    // ========================================

    // 共通の非表示スタイルを生成
    function createHiddenElementStyle(width, height) {
        return {
            position: 'fixed',
            top: '0',
            left: '0',
            width: width ? `${width}px` : undefined,
            height: height ? `${height}px` : undefined,
            opacity: PIP_CONFIG.ELEMENT_OPACITY,
            pointerEvents: 'none',
            zIndex: PIP_CONFIG.ELEMENT_Z_INDEX
        };
    }

    // Canvas要素を生成
    function createPipCanvas() {
        const canvas = document.createElement('canvas');
        canvas.id = 'pip-canvas';
        canvas.width = PIP_CONFIG.CANVAS_WIDTH;
        canvas.height = PIP_CONFIG.CANVAS_HEIGHT;
        Object.assign(canvas.style, createHiddenElementStyle());
        document.body.appendChild(canvas);
        return canvas;
    }

    // Video要素を生成
    function createPipVideo() {
        const video = document.createElement('video');
        video.id = 'pip-video';
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        Object.assign(video.style, createHiddenElementStyle(PIP_CONFIG.CANVAS_WIDTH, PIP_CONFIG.CANVAS_HEIGHT));
        document.body.appendChild(video);
        return video;
    }

    // PiP対応判定
    function isPictureInPictureSupported(videoElement) {
        return document.pictureInPictureEnabled ||
               (videoElement.webkitSupportsPresentationMode &&
                typeof videoElement.webkitSetPresentationMode === 'function');
    }

    // ログイン状態チェック
    function isUserLoggedIn() {
        return document.getElementById('is-logged-in')?.dataset?.loggedIn === 'true';
    }

    // レシピテーブルの存在チェック
    function hasConvertedRecipe() {
        const $recipeTable = $('.recipe-output');
        return $recipeTable.length > 0 && $recipeTable.find('tr').length > 1;
    }

    // ========================================
    // Canvas描画関連
    // ========================================

    // 背景を描画
    function drawBackground(ctx, width, height) {
        ctx.fillStyle = PIP_CONFIG.BACKGROUND_COLOR;
        ctx.fillRect(0, 0, width, height);
    }

    // ヘッダーを描画
    function drawHeader(ctx, width) {
        ctx.fillStyle = PIP_CONFIG.TEXT_COLOR;
        ctx.font = PIP_CONFIG.HEADER_FONT;

        // 左側：経過時間
        ctx.textAlign = 'left';
        ctx.fillText('経過時間', PIP_CONFIG.PADDING_X, PIP_CONFIG.HEADER_Y);

        // 右側：総注湯量
        ctx.textAlign = 'right';
        ctx.fillText('総注湯量', width - PIP_CONFIG.PADDING_X, PIP_CONFIG.HEADER_Y);

        // 区切り線
        ctx.strokeStyle = PIP_CONFIG.TEXT_COLOR;
        ctx.beginPath();
        ctx.moveTo(10, PIP_CONFIG.DIVIDER_Y);
        ctx.lineTo(width - 10, PIP_CONFIG.DIVIDER_Y);
        ctx.stroke();
    }

    // データ行を描画
    function drawRecipeData(ctx, width) {
        const $recipeTable = $('.recipe-output');
        let yPos = PIP_CONFIG.DATA_START_Y;

        $recipeTable.find('tr').each(function(index) {
            if (index === 0) return; // ヘッダー行スキップ

            const $cols = $(this).find('td');
            if ($cols.length >= 3) {
                const time = $cols.eq(0).text().trim();
                const totalWater = $cols.eq(2).text().trim();

                ctx.textAlign = 'left';
                ctx.fillText(time, PIP_CONFIG.PADDING_X, yPos);

                ctx.textAlign = 'right';
                ctx.fillText(totalWater, width - PIP_CONFIG.PADDING_X, yPos);

                yPos += PIP_CONFIG.ROW_HEIGHT;
            }
        });
    }

    // iOS対策：Canvas更新を通知するダミー描画
    function drawDummyPixel(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.01)';
        ctx.fillRect(0, 0, 1, 1);
    }

    // レシピテーブル全体をCanvasに描画
    function drawRecipeToCanvas(canvas) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        drawBackground(ctx, width, height);
        drawHeader(ctx, width);
        drawRecipeData(ctx, width);
        drawDummyPixel(ctx);
    }

    // ========================================
    // 音声トラック生成
    // ========================================

    // iOS対策：無音の音声トラックを生成
    function createSilentAudioTrack() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const destination = audioContext.createMediaStreamDestination();
        const gainNode = audioContext.createGain();

        gainNode.gain.value = 0; // 完全に無音化
        oscillator.connect(gainNode);
        gainNode.connect(destination);
        oscillator.start();

        return destination.stream.getAudioTracks()[0];
    }

    // ========================================
    // PiP機能関連
    // ========================================

    let animationLoopActive = false; // グローバル汚染を避けるためクロージャ内に配置

    // Canvas更新ループを開始（iOS対策）
    function startCanvasAnimationLoop(canvas) {
        if (animationLoopActive) return;

        animationLoopActive = true;
        const ctx = canvas.getContext('2d');

        function loop() {
            drawDummyPixel(ctx);
            requestAnimationFrame(loop);
        }
        loop();
    }

    // Videoストリームを初期化
    function initializeVideoStream(video, canvas) {
        if (video.srcObject) return;

        const stream = canvas.captureStream(PIP_CONFIG.STREAM_FPS);
        const audioTrack = createSilentAudioTrack();
        stream.addTrack(audioTrack);
        video.srcObject = stream;
    }

    // PiPモードを起動
    async function enterPictureInPicture(video) {
        await video.play();

        // iOS Safari用（webkitSetPresentationMode）を優先
        if (video.webkitSetPresentationMode) {
            video.webkitSetPresentationMode('picture-in-picture');
        } else if (video.requestPictureInPicture) {
            await video.requestPictureInPicture();
        }
    }

    // PiPボタンクリック時の処理
    async function handlePipButtonClick(canvas, video) {
        if (!hasConvertedRecipe()) {
            ModalWindow.showError('変換後レシピがありません。先にレシピを変換してください。');
            return;
        }

        try {
            drawRecipeToCanvas(canvas);
            startCanvasAnimationLoop(canvas);
            initializeVideoStream(video, canvas);
            await enterPictureInPicture(video);
        } catch (error) {
            console.error('PiPエラー:', error.name, error.message);
            ModalWindow.showError(`PiP起動に失敗しました:\n${error.message}`);
        }
    }

    // ========================================
    // 初期化処理
    // ========================================

    const pipCanvas = createPipCanvas();
    const pipVideo = createPipVideo();

    // PiP機能が利用可能かチェック
    const isPipSupported = isPictureInPictureSupported(pipVideo);
    const isLoggedIn = isUserLoggedIn();

    if (!isPipSupported || !isLoggedIn) {
        return; // PiP非対応またはログインしていない場合は早期リターン
    }

    // プレミアムユーザーかチェックしてPiPボタンを表示
    $.ajax({
        url: '/purchase/get_preset_limit/',
        method: 'GET',
        success: function(response) {
            if (response.preset_limit > PIP_CONFIG.PREMIUM_PRESET_LIMIT) {
                $('#pip-btn').show();

                $('#pip-btn').on('click', function() {
                    handlePipButtonClick(pipCanvas, pipVideo);
                });
            }
        },
        error: function(xhr) {
            if (xhr.status !== 401) {
                console.error('プレミアム状態の確認に失敗しました:', xhr);
            }
        }
    });
});