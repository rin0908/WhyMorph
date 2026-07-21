# WhyMorph

> 「なぜ？」を、操作できる学びへ。

WhyMorphは、GPT-5.6が自由な学習テーマを、変数を動かして因果関係を確かめられる教育シミュレーションへ変換するWebアプリです。

OpenAI Build Week Tokyo（2026-07-18）で制作しました。最初から遊べる火山危機管理と雨・雷の操作型体験に加え、テーマ・対象・学習ゴールを入力すると、GPT-5.6が新しいシナリオを構造化データとして生成し、安全なローカル計算で実行します。

## Problem

複雑な現象は、文章や静止画だけでは「どの要因が、どの結果へつながるか」を直感的に理解しにくいものです。また、題材ごとに専用シミュレーターを作るには時間と専門知識が必要です。

## Solution

WhyMorphは学習テーマを次の流れへ変換します。

```text
学びたいテーマを入力
→ GPT-5.6が変数・派生値・条件・ミッションを構造化
→ Web検索の実URLと、事実・仮定・信頼度を分けて提示
→ サーバーがZodで安全性を再検証
→ 決定論的なローカルエンジンで実行
→ GPT Image 2の通常／結果画像を閾値に合わせて切り替え
→ 学習者が変数を操作し、因果関係を発見
```

生成された文字列をコードとして実行せず、許可済みの数値・条件ASTだけを評価します。

## Demo

Public demo（この雨・雷版はユーザー確認前のため未反映）: https://whymorph.fumie1020.chatgpt.site

### 30秒の火山デモ

1. 初期状態を確認します。

   - マグマ量: `76`
   - ガス圧力: `82`
   - 火道の詰まり: `72`
   - 圧力指数: `80.9`
   - 警戒状態: 高

2. ガス圧力と火道の詰まりを下げると、圧力指数と警戒状態が即時に変わります。
3. `30 / 40 / 35` では圧力指数が `36.5` となり、安定化ミッションに成功します。
4. すべてを `100` にすると圧力指数は `100`、警戒レベルは `5` となり、噴火条件と失敗判定を確認できます。
5. 「テーマから生成」で別の学習テーマをGPT-5.6の因果シミュレーションへ変換します。

> 火山モデルは教育・体験用です。実際の噴火予測や避難判断には使用できません。

### 30秒の雨・雷デモ

1. 初期値 `水蒸気20 / 不安定さ20 / 上昇気流15` では「晴れ」です。
2. `50 / 30 / 35` で薄い雲が現れ、`70 / 50 / 70` で雲が縦に発達します。
3. `90 / 60 / 80` では降水条件がそろい、24本の雨粒が動きます。
4. `100 / 60 / 100` では54本の強い雨になりますが、氷相と電荷分離が不足するため雷は発生しません。
5. `90 / 90 / 90` では正負電荷を示す雷雲になりますが、放電の目安には届きません。
6. `95 / 95 / 95` で初めて放電条件がそろい、間隔を空けた短い稲妻を表示します。
7. 1つずつ条件を下げると、雷から雨・雲・晴れへ決定論的に戻ります。「初期値」で `20 / 20 / 15` に戻ります。

> 本モデルの値は教育用の相対指標です。天気予報や雷の安全判断には使用できません。

## Main features

- 3変数を操作するリアルタイム因果シミュレーション
- リアルな火山断面、圧力指数、警戒状態、ミッション結果の連動表示
- 水蒸気・不安定さ・上昇気流から7つの派生値を計算する雨・雷モデル
- 晴れ、雲のでき始め、発達した雲、雨、強い雨、雷雲、雷発生の7状態
- 半リアルなCSS雲、決定論的な雨粒、正負電荷、電位差メーター（教育用代理指標）、間隔を空けた稲妻
- 現在不足している条件と、状態に一致する短い学習説明
- GPT-5.6による任意テーマへの回答とシナリオ生成
- Responses API Web searchによる参考資料の実URL表示
- 事実、教育用の数値仮定、モデル信頼度の分離表示
- GPT Image 2によるテーマ別の写実的な通常／結果画像
- GPT生成シナリオを同じ汎用エンジンへ安全に切り替え
- 入力制限、5分あたり3回の簡易IPレート制限、厳密な生成結果検証
- キーボード操作、`aria-live`、レスポンシブ表示
- `prefers-reduced-motion` 対応
- GPT生成が利用できない場合も火山MVPを継続利用可能

## Simulation model

火山デモの圧力指数は、宣言的な式としてデータに保存されています。

```text
pressure = clamp(
  0.42 × magma
  + 0.36 × gas
  + 0.27 × blockage,
  0,
  100
)
```

成功条件:

```text
pressure <= 42
AND gas <= 55
AND blockage <= 50
```

噴火・失敗条件:

```text
pressure >= 92
OR (
  pressure >= 85
  AND gas >= 82
  AND blockage >= 78
)
```

成功条件と失敗条件が同時に成立した場合は失敗を優先します。

警戒レベル1〜4は通常状態の段階、レベル5は噴火条件そのものから算出します。そのため、噴火判定と警戒表示が食い違いません。この指数・係数・閾値は因果関係を学ぶための教育用設定であり、気象庁の噴火警戒レベルや公的な噴火予測式ではありません。

### 雨・雷モデル

利用者が直接操作する値は `waterVapor`（空気中の水蒸気量）、`instability`（大気の不安定さ）、`updraft`（上昇気流の強さ）の3つだけです。すべて0〜100へ制限し、雲の発達度を直接操作させません。非有限値は拒否し、状態判定に乱数を使いません。

正規化した3入力を `w`、`i`、`u`、0〜1に制限する関数を `clamp01`、指定値から100まで0→1へ増える関数を `ramp` とすると、派生値は次の固定式で計算し、最後に0〜100へ変換します。

```text
condensation = w × (0.65u + 0.35i)
cloud = condensation × (0.45 + 0.30i + 0.25u)
particle = cloud × (0.50w + 0.30u + 0.20i)
precipitation = particle × (0.55cloud + 0.25w + 0.20u)

ice = cloud × ramp(instability, 30) × ramp(updraft, 35)
charge = ice × ramp(updraft, 45) × (0.55i + 0.45cloud)
lightningPotential = charge × (0.55ice + 0.25u + 0.20i)
```

水蒸気と上昇・不安定さを掛け合わせるため、水蒸気だけ、または上昇気流だけを最大にしても雨・雷にはなりません。雨と雷は別ゲートです。雨が強くても、氷相・電荷分離・大気の不安定さが不足すれば雷雲にも放電にもなりません。

名前付き閾値は `app/data/rain-lightning.ts` に集約しています。値は自然界の予報基準ではなく、教育用相対指標の状態分けです。

| 状態または開始条件 | 名前付き閾値と判定 |
|---|---|
| 氷相開始 | `ICE_PHASE_INSTABILITY_ONSET = 30`、`ICE_PHASE_UPDRAFT_ONSET = 35` |
| 電荷分離開始 | `CHARGE_SEPARATION_UPDRAFT_ONSET = 45` |
| 雲ができ始める | `CLOUD_FORMING_CONDENSATION_MIN = 8` かつ `CLOUD_FORMING_DEVELOPMENT_MIN = 6` |
| 雲が発達する | `CLOUD_DEVELOPING_CONDENSATION_MIN = 25`、`CLOUD_DEVELOPING_DEVELOPMENT_MIN = 30`、`CLOUD_SUPPORT_INSTABILITY_MIN = 35` または `CLOUD_SUPPORT_UPDRAFT_MIN = 45` |
| 雨 | `RAIN_CLOUD_MIN = 35`、`RAIN_PARTICLE_GROWTH_MIN = 28`、`RAIN_PRECIPITATION_MIN = 20` |
| 強い雨 | `HEAVY_RAIN_CLOUD_MIN = 55`、`HEAVY_RAIN_PARTICLE_GROWTH_MIN = 60`、`HEAVY_RAIN_PRECIPITATION_MIN = 55` |
| 雷雲 | `THUNDERCLOUD_CLOUD_MIN = 60`、`THUNDERCLOUD_ICE_PHASE_MIN = 45`、`THUNDERCLOUD_CHARGE_MIN = 30`、`THUNDERCLOUD_INSTABILITY_MIN = 70`、`THUNDERCLOUD_UPDRAFT_MIN = 70` |
| 雷発生 | `LIGHTNING_CLOUD_MIN = 70`、`LIGHTNING_ICE_PHASE_MIN = 65`、`LIGHTNING_CHARGE_MIN = 55`、`LIGHTNING_POTENTIAL_MIN = 50`、`LIGHTNING_INSTABILITY_MIN = 85`、`LIGHTNING_UPDRAFT_MIN = 85` |
| 説明文の高入力／低入力 | `EXPLANATION_HIGH_INPUT_MIN = 70`、`EXPLANATION_LOW_INPUT_MAX = 35` |

状態は `雷発生 → 雷雲 → 強い雨 → 雨 → 雲が発達する → 雲ができ始める → 晴れ` の優先順で、各状態の複数条件を評価します。これは一本道の時間遷移ではありません。入力を下げた場合も同じ純関数で再評価し、適切な状態へ戻ります。

科学的仮定と簡略化:

- 実際の気温、露点、気圧、鉛直風速、雲底・雲頂高度を入力していないため、上昇気流と不安定さを上昇冷却・鉛直発達の代理にしています。
- 氷相発達度は、雲が冷たい上層へ達し、氷晶・霰・過冷却水滴の衝突が起こりやすくなる度合いの代理です。
- 雷発生可能性は電圧、観測確率、発雷確率ではありません。
- 風、地形、エアロゾル、粒径分布、落下速度、時間発展、局地差は計算していません。
- 雷の詳しい帯電過程には現在も研究されている部分があります。

### 開発中・公開非表示のクモ糸×飛行機モデル

このコードと監査記録は比較研究用に残していますが、現在の公開UIからimport、描画、ナビゲーション、体験カードを外しています。公開利用者は選択できません。

対象は実物旅客機 `Boeing 737-8` です。初期質量 `82,871 kg` は[Boeing公式空港計画資料 Rev K](https://www.boeing.com/content/dam/boeing/boeingdotcom/commercial/airports/acaps/737MAX_RevK.pdf)の最大設計タキシー質量（仕様表の上限）で、写真撮影時の実測質量ではありません。

9入力は出典範囲または明示した教育用範囲へ制限し、次をSI単位で計算します。

```text
gravity = 9.80665 m/s²

rollingResistance = rollingResistanceCoefficient × mass × gravity
slopeForce = mass × gravity × sin(slopeAngle)
accelerationForce = mass × targetAcceleration
requiredForce = rollingResistance + slopeForce + accelerationForce

threadDiameterMeters = threadDiameterMicrometers × 10^-6
threadArea = PI × (threadDiameterMeters / 2)^2
tensileStrengthPa = tensileStrengthMPa × 10^6
singleThreadBreakingForce = tensileStrengthPa × threadArea
effectiveBreakingForcePerThread = singleThreadBreakingForce × attachmentEfficiency
safeForcePerThread = effectiveBreakingForcePerThread / safetyFactor
bundleBreakingForce = threadCount × effectiveBreakingForcePerThread
bundleSafeForce = threadCount × safeForcePerThread
breakingThreadCount = ceil(requiredForce / effectiveBreakingForcePerThread)
requiredThreadCount = ceil(requiredForce / safeForcePerThread)
```

入力範囲と初期値は次のとおりです。資料にない操作範囲は、出典値と混同しないよう教育用仮定と明記しています。

| 入力 | 最小 | 初期 | 最大 | 刻み | 根拠または仮定 |
|---|---:|---:|---:|---:|---|
| 飛行機の質量 | 60,000 kg | 82,871 kg | 82,871 kg | 1 kg | 上限・初期値はBoeing公式の737-8最大設計タキシー質量。下限は感度比較用の教育範囲 |
| 転がり抵抗係数 | 0.015 | 0.020 | 0.020 | 0.001 | FAA掲載資料の乾燥路面・無制動タイヤの一般範囲。737-8固有値ではない |
| 滑走路の傾斜 | 0° | 0° | 1.15° | 0.05° | 水平を初期値とした教育用UI範囲。上限は約2%勾配の感度比較 |
| 目標加速度 | 0.001 m/s² | 0.020 m/s² | 0.050 m/s² | 0.001 m/s² | 低速牽引を比較する教育用仮定 |
| クモ糸の直径 | 8 µm | 10 µm | 11 µm | 0.1 µm | Wu et al. (2018) の測定範囲 |
| クモ糸の引張強度 | 800 MPa | 1,000 MPa | 1,100 MPa | 10 MPa | Wu et al. (2018) の測定範囲 |
| 安全率 | 1 | 3 | 10 | 0.1 | 教育用仮定。航空機牽引設計の規格値ではない |
| 固定効率 | 0 | 0.5 | 1 | 0.05 | 結び目・固定部で力を伝える割合の教育用仮定。0は固定不能 |
| 糸の本数 | 1本 | 1本 | 100,000,000本 | 1本 | 整数。上限は比較計算のためのUI上限で、製造可能性を意味しない |

固定効率0を最初に判定し、その後は破断を安全ゲートとして移動より優先します。

```text
attachmentEfficiency = 0
  → 固定部が力を伝えられない。糸は破断せず、飛行機は動かさない

requiredForce > threadCount × effectiveBreakingForcePerThread
  → 糸が先に破断、飛行機は動かさない

破断はしないが requiredForce > threadCount × safeForcePerThread
  → 安全率不足、飛行機は動かさない

threadCount >= requiredThreadCount かつ破断しない
  → 入力した簡略モデル内でのみ移動条件成立
```

破断表示は、牽引側が必要牽引力まで張力をゆっくり増やす試行を仮定しています。破断力に達する前に引くのを止めた場合は、糸は切れず、飛行機も動きません。

初期値（質量82,871 kg、転がり抵抗係数0.02、水平、目標加速度0.02 m/s²、直径10 µm、引張強度1,000 MPa、安全率3、固定効率0.5）では、必要牽引力は約17,911 N、糸1本の安全使用力は約0.01309 N、必要本数は1,368,312本です。糸1本・2本では絶対に機体を動かしません。

クモ糸の初期物性は[Wu et al. (2018)](https://pubmed.ncbi.nlm.nih.gov/30321988/)のNephila pilipesドラグライン測定範囲（直径8〜11 µm、引張強度800〜1,100 MPa）内です。転がり抵抗係数0.02は[FAA掲載資料](https://www.faa.gov/sites/faa.gov/files/2022-11/AAR85-06.pdf)の乾燥路面・無制動タイヤの範囲を参照した一般仮定で、737-8固有の実測値ではありません。標準重力9.80665 m/s²は[NIST](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8)を参照しています。

## Architecture

```text
Browser
  ├─ VolcanoLab UI
  ├─ volcano sliders / causal map / missions
  ├─ RainLightningLab / 3 inputs / 7 derived indexes / weather animation
  ├─ SpiderPlaneLab (development-only; not imported by the public UI)
  └─ POST /api/scenario
          ↓
Server route
  ├─ request validation
  ├─ rate limiting
  ├─ OpenAI Responses API (gpt-5.6 + Web search)
  ├─ strict Structured Outputs
  ├─ OpenAI Image API (gpt-image-2)
  ├─ actual search-source URL extraction
  └─ Zod semantic validation
          ↓
Safe simulation engine
  ├─ numeric AST
  ├─ condition AST
  ├─ derived metrics
  └─ alert / outcome / mission evaluation
```

主要ファイル:

- `app/VolcanoLab.tsx`: インタラクティブUIとシナリオ切り替え
- `app/RainLightningLab.tsx`: 3入力、7派生値、状態説明、雲・雨・電荷・雷の表示
- `app/RainLightningLab.module.css`: 火山CSSから隔離した半リアルな空と安全なアニメーション
- `app/data/rain-lightning.ts`: 雨・雷の固定式、名前付き閾値、入力制限、純粋な状態評価
- `app/SpiderPlaneLab.tsx` / `app/data/spider-plane.ts`: 公開UIから外した開発中モデル
- `app/data/volcano.ts`: 火山シナリオの変数・式・条件・文言
- `app/lib/simulation.ts`: 汎用AST評価エンジン
- `app/lib/scenario-schema.ts`: 入力・生成結果のZod検証
- `app/api/scenario/route.ts`: GPT-5.6 Responses API
- `tests/*.test.ts`: エンジンとAPI境界の自動テスト
- `public/og.png`: 承認済みの最終OG画像

## How GPT-5.6 is integrated

`POST /api/scenario` が次の入力を受け取ります。

- `theme`
- `audience`
- `learningGoal`

サーバー側でのみ `OPENAI_API_KEY` を使用し、Responses APIの `gpt-5.6`、Web search、Strict Structured Outputsで回答とシナリオJSONを生成します。出典URLをモデルのJSONに書かせず、Web searchのツール出力に実在するHTTPS URLだけを抽出します。生成結果はZodによる構造・範囲・参照整合性の検証を通過した場合だけブラウザへ返します。

同時にImage APIの `gpt-image-2` が、同一構図の「通常状態／結果状態」を1枚の写実的な比較画像として生成します。スライダー操作のたびに画像APIを呼ばず、決定論エンジンの閾値判定に応じて2状態を切り替えます。画像生成だけ失敗した場合は、回答とシミュレーションを維持して因果マップへフォールバックします。

入力は信頼しないデータとして扱い、本文内の命令へ従わないようサーバー指示を分離しています。失敗時に架空の成功データを返しません。

## Safety design

シミュレーションエンジンが許可する演算は限定されています。

- 数値: `add`, `subtract`, `multiply`, `divide`, `min`, `max`, `clamp`
- 比較: `lt`, `lte`, `eq`, `neq`, `gte`, `gt`
- 論理: `all`, `any`, `not`

以下を拒否します。

- 未知のノードや演算子
- `NaN` / `Infinity`
- ゼロ除算
- 派生値の循環参照
- 変数範囲外のリセット値
- 不正なID、色、参照先、過度に複雑なAST

`eval()` と `new Function()` は使用していません。

## Tech stack

- Vinext / Next.js 16 App Router
- React 19
- TypeScript 5.9
- Vite 8
- Cloudflare Workers / OpenAI Sites
- OpenAI JavaScript SDK 6
- Zod 4
- Node.js test runner

## Setup

Requirements:

- Node.js 22.13以上
- GPT生成を使う場合はOpenAI APIキー

```powershell
npm ci --cache .\work\npm-cache
Copy-Item .env.example .env.local
```

`.env.local` に自分のキーを設定します。キーをGit、README、画面、スクリーンショットへ含めないでください。

```dotenv
OPENAI_API_KEY=
```

開発サーバー:

```powershell
npm run dev
```

## Test and build

```powershell
npm test
npm run typecheck
npm run build
```

2026-07-22のローカル検証（雨・雷版、公開前）:

- Unit/API tests: 55 / 55 passed
- TypeScript: passed
- ESLint: passed
- Production build: passed
- Local GET `/`: HTTP 200
- Browser: 雨・雷の7状態、単独最大3条件、雨粒24/54本、雷なし強雨、電荷分離、稲妻、逆戻り、リセットを確認
- Browser: 390 px幅で横スクロールなし、入力・状態・空・雲・派生値を確認
- Browser: 火山の `76 / 82 / 72 → 圧力80.9・警戒4`、`100 / 100 / 100 → 圧力100.0・警戒5・噴火`、リセットを確認
- Protected volcano files: `before-rain-lightning` と同一
- API key未設定時の `POST /api/scenario`: 明示的なHTTP 503
- GPT-5.6 / Web search / GPT Image 2実通信: HTTP 200（4警戒段階、実出典5件、写実画像WebPを確認）

## Accessibility

- すべてのレンジ入力にラベルと現在値を付与
- 雨・雷の3入力は大きなスライダーと0〜100の数値入力を同期
- 状態変化を `aria-live` で通知
- 正負電荷は記号と日本語ラベルを併記し、電位差メーター（物理的電圧ではない教育用代理指標）を `role="meter"` で通知
- キーボードフォーカスを可視化
- 色だけに依存せず数値・ラベル・説明を併用
- モバイル向けレイアウト
- `prefers-reduced-motion` では雨粒の移動と稲妻の点滅を止め、静止表現で状態を保持

## How Codex was used

Codexを共同開発者として、資料確認、公式OpenAI仕様の検証、アーキテクチャ設計、実装、テスト、OG制作、セキュリティ確認、公開準備に使用しました。生成コードは型検査・自動テスト・本番ビルドで検証し、重要な設計判断は `BUILD_LOG.md` に記録しています。

## Key decisions

- 火山専用UIをMVPとして完成させつつ、エンジンは任意テーマへ再利用可能にする
- GPTは構造化シナリオを作り、結果計算は決定論的エンジンへ任せる
- AI生成コードを実行しない
- GPT障害時もローカルMVPを使えるようにする
- 火山エンジンを一般化せず、雨・雷を独立した型付き純関数とCSS Moduleへ隔離する
- クモ糸×飛行機はコードを保持したまま公開UIから外す
- プロジェクト名は承認済みのWhyMorphへ統一する
- 最終OGは承認済み画像を採用し、旧版を別名で保持する

## Limitations

- GPT生成用の汎用ASTは制御変数3種類、派生指標1種類に固定（雨・雷は独立した型付き3入力・7派生値モデル）
- 雨・雷モデルは相対指標で、気温・露点・気圧・風・地形・粒径分布・時間発展を扱わず、予報には使用できない
- クモ糸×飛行機モデルは開発中コードとして残るが、現在の公開UIからは選択できない
- 飛行機モデルは低速・一次元・無風、エンジン停止、ブレーキ解除、糸の真円断面、荷重均等分担を仮定。牽引点、衝撃、疲労、湿度、長さによる欠陥確率は扱わない
- 自然クモ糸を数百万本均一に生産・整列・固定できるかは評価しない
- 実写写真の機体領域をインラインSVGマスクで分離し、そのレイヤーだけをデスクトップ18 px／モバイル8 px移動する。背景は静止し、距離・時間の縮尺ではない
- 時間発展・確率モデル・永続化・ユーザー認証は未実装
- 生成シナリオは教育用の簡易モデルで、専門判断には使用不可
- GPTの信頼度はモデルの自己評価であり、専門家による妥当性確認ではない
- テーマ画像は生成に時間がかかる場合があり、セッションを越えて永続保存しない
- インメモリのレート制限は分散環境で厳密な全体上限にはならない
- GPT実通信には実行環境ごとの `OPENAI_API_KEY` 設定が必要

## Future work

- 生成画像の永続キャッシュと再利用
- 教員による承認・編集フロー
- 複数ミッションと学習履歴
- 学年・理解度に合わせた説明
- 物理・生物・地学・経済などのテンプレート集
- 永続的な分散レート制限
- 公開デモ向けTurnstileまたは利用者単位の生成上限

## Third-party libraries and licenses

各依存パッケージはそれぞれのライセンスに従います。プロジェクトの依存バージョンは `package-lock.json` で固定しています。

開発中コードに保持する飛行機写真 `public/boeing-737-taxi-cc-by-sa-4.jpg`（現在の公開UIでは未使用）:

- 原題: “Singapore Airlines Boeing 737 9V-MBA Singapore 2025 (02)”
- 作者: Bahnfrend
- 出典: [Wikimedia Commonsの元ファイルページ](https://commons.wikimedia.org/wiki/File:Singapore_Airlines_Boeing_737_9V-MBA_Singapore_2025_(02).jpg)
- ライセンス: [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/)
- 用途: 同型旅客機の代表視覚。写真撮影時の質量を計算値として使用していない
- 変更: 原JPEGのバイト列は変更していない。画面では機体領域をインラインSVGマスクで切り抜いた派生表示と、同写真から作る静止背景を重ねる
- 派生表示: 作者表示と同じCC BY-SA 4.0を維持し、画面内と本READMEから元画像・作者・ライセンスへリンク

## Judge Quick Start

### Live Demo

The project can be tested immediately without an account or installation:

https://whymorph.fumie1020.chatgpt.site

No login credentials are required.

Supported platforms:
- Desktop web browsers
- Tablet web browsers
- Mobile web browsers

### Local Installation

Requirements:
- Node.js 22.13 or later
- An OpenAI API key only for GPT-generated simulations

Commands:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

## License

ソースコードはMITです。詳細は `LICENSE` を参照してください。上記の飛行機写真はMITの対象外で、CC BY-SA 4.0と作者表示を維持します。

