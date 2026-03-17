# Roamble マスコットキャラクター方向性

> 最終更新: 2026-03-16

---

## ブランドDNA（前提整理）

| 要素 | 内容 |
|------|------|
| コンセプト | "Reluctant Explorer"（気が進まない冒険者） |
| トーン | 素朴な独り言・淡々と・弱音OK |
| ユーザー心理 | 「怖い」「めんどくさい」「でも行きたい」 |
| 価値体験 | **怖かったけど行けた** → 成功体験の蓄積 |
| 報酬メッセージ | 「やるじゃん！」|
| ゲーミフィケーション | XP・レベル・バッジ（RPG感） |

---

## 各方向性の評価

### ❌ コーチ系（「できる！行け！」型）

Duolingoのフクロウに近い、叱咤激励・プレッシャー型。

**ブランドと最も合わない。** ユーザーは「怖い」という感情を抱えている人。「なんでできないの？」というコーチング圧力は逆効果で、Roambleの「適度な背中押し」の思想と真逆。

---

### ✅✅ 伴走系（「俺も怖いけど一緒に行こう」型）

キャラ自身もちょっと怖がっている・気が進まない性格。

**"Reluctant Explorer" コンセプトと直結するため、最もブランドに合致する。**

- 「ここ、なんか入りにくそうだよね。でもせっかくだし…行く？」
- ユーザーと同じ目線で「怖さ」を共有している
- 「一人じゃないよ」という安心感を与える

---

### ✅ 承認系（「よくやった！えらい！」型）

達成・報酬フェーズに特化した称賛キャラ。

**XP獲得・バッジ取得の文脈でよく機能するが、単独では単調。** 伴走系のキャラが達成後に「...まあ、よくやったな」と言う構造の方が感情の振れ幅が大きい。

---

### ✅ ツンデレ／毒舌愛あり系（「正気か？でも認める」型）

冒険の証明書の「正気か？」メッセージと直結したユーモア感。

**等身大の淡々としたトーンに最も合う毒気。**
- 行く前：「え、そこ行くの？まじで？」
- 行った後：「...正気か。でもまあ、よくやった」

ブランドの「過剰に褒めない、飾らない」トーンと合致する。

---

## 推奨方向性：「渋々伴走型 × ちょいツンデレ」

```
普段：「俺も実は怖いんだよね。でも一緒に行ってみようか？」
達成：「やるじゃん！」
うまくいってない時：「どうする?せっかくだし...行ってみる？」
```

### このキャラが合う理由

1. **ユーザーの感情に寄り添う** — 「怖い」を否定しない、一緒に怖がってくれる
2. **等身大トーンを守れる** — 過剰な明るさがなく、淡々とした発信スタイルと一致
3. **ゲーミフィケーションとの相性** — RPGの「不本意な主人公が成長していく」物語構造と合致
4. **証明書の「正気か？」と整合** — 既に出来上がっているコピーのトーンを拡張できる

> **一言で言うと**: Duolingoが「叱咤するコーチ」なら、Roambleのマスコットはその真逆 — **「一緒に怖がってくれる、気弱な相棒」**

---

## ビジュアルモチーフ候補

| モチーフ | 理由 |
|---------|------|
| ペンギン | 歩き方がちょこちょしていて「渋々前進する」イメージに合う。シンプルな色使いでキャラが成立するため、アニメーションコストも低い。 |
| カタツムリ | ゆっくり確実に進むイメージ。ただし、あまりに遅すぎると「全然進まない」印象になりそう。 |
| クマ | 大きくてちょっと怖そうな見た目と、実は気が弱いギャップが面白い。ただし、シルエットが複雑でアニメーションコストが高そう。 |
| タコ | 8本の腕で色々なことに挑戦しているイメージ。ただし、あまりに奇抜すぎると親しみづらい可能性がある。 |

---

## 決定案：ぽってりしたペンギン

**なぜペンギンか**: 歩き方がおぼつかない・ちょこちょこ動くビジュアルが「渋々前進する」と親和性が高い。白黒のシンプルなシルエットに差し色1色でキャラが成立するため、アニメーションコストが低い。あと、臆病そうな表情をとらせた時に映えそう。

### NanoBanana 参考プロンプト

> スタイルの目標: Duolingo のフクロウと同レベルのシンプルさ・清潔感。うるうる目・ほっぺ赤みなし。表情は顔のパーツの形だけで表現する。

**ベースプロンプト（全バリエーション共通の土台）**

画像：docs/marketing/mascot/default.png

```
A small, pudgy penguin mascot in flat vector style. Inspired by the visual simplicity of the Duolingo owl — clean bold outlines, flat solid colors, minimal details. Round belly, compact body, short flipper-arms resting at the sides. Face has a calm but slightly uncertain expression using only simple shapes: plain oval eyes with small dot pupils (no shine, no highlight), eyebrows as two short slightly angled lines suggesting mild hesitation, small closed beak. No blush marks, no teary eyes, no kawaii decorations. Color palette: off-white belly, muted navy body, warm amber beak and feet. Flat vector, bold clean outlines, no gradients, no textures, no background. White background.
```

---

### バリエーションプロンプト

> 各プロンプトは「ベースプロンプト」の末尾にそのまま追記して使う。

---

#### ストリーク更新時（「よっしゃ！」）

キャラのトーン: 素直に嬉しい。両翼を上げたガッツポーズ。珍しく感情が出ている。

画像：docs/marketing/mascot/joy.png

```
Expression variant — streak updated: Both flipper-arms raised up in a small celebration gesture — a genuine, unguarded happy moment. Eyebrows raised with a clear smile, mouth open in a happy grin. Body slightly bounced upward, feet barely off the ground. The expression is openly joyful — this is one of the rare times the character isn't holding back. No props or decorations needed.
```

---

#### ストリークが切れそうな時（「え、ちょ、まって」）

キャラのトーン: 焦り・動揺。目を少し見開き、手を前に出す「待って」ジェスチャー。眉は内側に傾けて心配そうな表情。

画像：docs/marketing/mascot/streak_at_risk.png, docs/marketing/mascot/streak_at_risk_2.png
1枚目は右手が前に出ていなくて好みじゃない。2枚目は手の向きはいいが、指が一本一本描かれていてキモい。両方のいいとこ取りで、手はシンプルなフラットな形で前に出ているのが理想。

```
Expression variant — streak at risk: Both flipper-arms held out slightly forward, palms-out gesture as if saying "wait, wait". Eyes slightly wider than normal, eyebrows angled inward in a worried frown. Mouth open slightly — tense, not panicked. Small single sweat drop on the side of the head (simple teardrop shape, one color). Body leaning slightly forward.
```

---

#### バッジ獲得時（「もらった！」）

キャラのトーン: 誇らしい。両手でバッジを正面に掲げて見せている。

画像: まだなし。あとで生成させる。

```
Expression variant — badge earned: Holding a small flat badge shape up in front with both flipper-arms, displaying it proudly toward the viewer. Eyes wide and bright with a big smile — genuinely pleased. Eyebrows raised in delight. Body upright and proud. Badge is a simple geometric shape (circle or hexagon) in a single accent color. No sparkles or stars, just the character's honest pride coming through.
```

---

#### XP獲得時（「おっ」）

キャラのトーン: ちょっと嬉しい。片翼をぐっと上げたサムズアップ的なポーズ。

画像: まだなし。あとで生成させる。

```
Expression variant — XP gained: One flipper-arm raised with a small thumbs-up-like gesture. Mouth in a clear, relaxed smile — genuinely pleased but not over the top. Eyebrows slightly raised in a satisfied expression. Body posture easy and confident. The impression is light and positive: a small but real win acknowledged with warmth.
```

---

#### 月次・週次サマリー時（「で、結局どうだった？」）

キャラのトーン: 振り返り・思慮。あごに翼を当てて考えているポーズ。

画像: まだなし。あとで生成させる。

```
Expression variant — weekly/monthly summary: One flipper-arm raised with the tip touching just below the beak, like a thinking pose. Eyes looking slightly upward-left as if reflecting. Eyebrows in a gentle inward angle — thoughtful, not worried. Mouth neutral or very slight frown. Body relaxed, not tense. The pose reads as quietly reviewing something.
```
