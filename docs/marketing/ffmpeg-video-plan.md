# ffmpeg動画制作 — 計画ドキュメント
> 目的: CapCutの代わりにffmpegでショート動画を自動生成し、Claude CodeのSKILLとして再利用可能にする

---

## 1. ffmpegインストール

```bash
brew install ffmpeg
ffmpeg -version  # 確認
```

---

## 2. 必要素材（毎回用意するもの）

| ファイル | 説明 |
|---------|------|
| `hand.mp4` | 手元カット（縦撮り・9:16） |
| `screen1.mp4` | 画面録画①（提案画面） |
| `screen2.mp4` | 画面録画②（XP獲得〜バッジ） |
| `screen3.mp4` | 画面録画③（トップ画面・CTA用） |
| `bgm.mp3` | BGM（著作権フリー） |

> 素材は `docs/marketing/assets/YYYYMMDD/` に日付フォルダで管理する

---

## 3. 動画生成フロー

### Step 1: 素材の前処理（サイズ・フレームレート統一）
```bash
# 各クリップを9:16 / 1080x1920 / 30fpsに統一
ffmpeg -i hand.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" -r 30 hand_norm.mp4
# screen1〜3も同様
```

### Step 2: テロップ付与（drawtext）
```bash
# 例: フック用テロップ
ffmpeg -i hand_norm.mp4 \
  -vf "drawtext=text='Roambleベータ版、想定以上の反響です':fontfile=/path/to/NotoSansJP-Bold.ttf:fontsize=85:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=100" \
  hand_text.mp4
```

> フォントファイルのパスは環境によって異なる。`fc-list | grep Noto` で確認。

### Step 3: トランジション合成
```bash
# フラッシュ（白）トランジション: xfadeフィルタを使用
ffmpeg -i clip1.mp4 -i clip2.mp4 \
  -filter_complex "[0][1]xfade=transition=fade:duration=0.2:offset=4.8" \
  merged.mp4
```

### Step 4: クリップ結合
```bash
# concat demuxerで結合
cat > filelist.txt << EOF
file 'hand_text.mp4'
file 'screen1_text.mp4'
file 'screen2_text.mp4'
file 'screen3_text.mp4'
EOF

ffmpeg -f concat -safe 0 -i filelist.txt -c copy merged_all.mp4
```

### Step 5: BGM合成・音量調整
```bash
ffmpeg -i merged_all.mp4 -i bgm.mp3 \
  -filter_complex "[1:a]volume=0.45[bgm];[0:a][bgm]amix=inputs=2:duration=first" \
  -c:v copy output_final.mp4
```

### Step 6: 最終チェック
```bash
# 尺確認
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1 output_final.mp4
```

---

## 4. SKILLとして再利用する設計

### スキル名
`ffmpeg-video-creator`

### スキルの責務
1. 台本ファイル（`video_YYYYMMDD_*.md`）を読み込む
2. 必要素材のチェックリストを出力する
3. 素材が揃ったらffmpegコマンド列を生成・実行する
4. 完成動画を `docs/marketing/assets/YYYYMMDD/output_final.mp4` に出力する

### SKILL.mdの構成案
```
- 台本mdファイルのパスを受け取る
- セクション構成表を解析してクリップ長・テロップ・トランジションを抽出
- フォントファイルのパスを自動検索（fc-list）
- 各Stepのffmpegコマンドを順に実行
- エラー時は原因を特定して代替コマンドを提示
```

### ディレクトリ構成
```
.claude/skills/ffmpeg-video-creator/
├── SKILL.md          # スキル定義
└── references/
    ├── ffmpeg-commands.md   # コマンドリファレンス
    └── font-setup.md        # フォント設定手順
```

---

## 5. 既知の制約と対処

| 制約 | 対処 |
|------|------|
| 日本語フォントが必要 | `brew install font-noto-sans-cjk` で導入 |
| タイプライター・バウンスアニメは複雑 | フェードイン代替で十分なクオリティを担保 |
| テロップの部分カラー（黄色強調）が難しい | 強調部分を別テキストレイヤーとして重ねる |
| 画面録画の位置情報モザイク | `drawbox`フィルタで白矩形を重ねる |

---

## 6. 次のチャットでやること

1. `brew install ffmpeg` 実行・確認
2. Notoフォントのインストールとパス確認
3. 素材フォルダ（`docs/marketing/assets/20260310/`）を作成して素材を配置
4. このドキュメントのStep 1〜6を順に実行
5. 動作確認後、`ffmpeg-video-creator` SKILLを作成
