# WhyMorph — Build Log

- Event: OpenAI Build Week Tokyo
- Date: 2026-07-18
- Status: public MVP exists; science-audited airplane repair is verified locally and awaiting user approval before deployment
- Tagline: 「なぜ？」を、操作できる学びへ。

## Goal

自由な学習テーマを、学習者が変数を操作して因果関係を発見できるシミュレーションへ変換する教育アプリを作る。

MVPでは、火山危機管理を最初から遊べる高品質な例として完成させる。プロダクト全体は火山専用にせず、GPT-5.6が別テーマの変数・式・条件・ミッションを生成し、同じ安全なエンジンで実行できる構成にする。

## Builder decisions

- 正式名称は承認後に `WhyMorph` へ統一
- 最終OGはユーザー承認済み画像だけを採用し、OGの追加生成はしない
- 火山MVPを最優先し、その後GPT連携を追加
- AIは構造化シナリオを生成し、数値計算は決定論的エンジンが担当
- AI生成コードを実行しない
- GPT失敗時もローカル火山MVPを継続利用できる
- APIキーはサーバー側だけで参照
- プロジェクトは指定された元フォルダー内の `WhyMorph/` だけで管理

## Phase 1 — Experience design

一画面で次の流れが伝わることを目標にした。

```text
3変数を操作
→ 圧力指数が変化
→ 警戒状態が変化
→ ミッション成功または噴火
→ 入力と結果の因果関係を振り返る
```

ビジュアルは、暗い研究ラボ、溶岩オレンジ、計器シアン、火山断面を組み合わせた。恐怖を強調せず、教育・実験・発見の印象を優先した。

## Phase 2 — Safe simulation engine

`app/lib/simulation.ts` に汎用評価エンジンを実装した。

- 数値式ASTの評価
- 条件ASTの評価
- 派生値の計算
- 警戒段階のfirst-match判定
- 噴火判定
- ミッション成功・失敗判定
- immutableな状態更新
- リセット
- 任意シナリオの評価

許可演算子は `switch` で明示し、未知の演算子、非有限数、ゼロ除算、循環参照を拒否する。`eval` と `Function` は使用しない。

## Phase 3 — Volcano scenario

`app/data/volcano.ts` へ変数、圧力式、警戒段階、噴火条件、ミッション、初期値、表示文言を宣言データとして分離した。

圧力式:

```text
clamp(0.42 × magma + 0.36 × gas + 0.27 × blockage, 0, 100)
```

デモ用状態:

| 状態 | Magma | Gas | Blockage | Pressure | 結果 |
|---|---:|---:|---:|---:|---|
| 初期 | 76 | 82 | 72 | 80.9 | 警戒・進行中 |
| 成功例 | 30 | 40 | 35 | 36.5 | ミッション成功 |
| 噴火例 | 100 | 100 | 100 | 100.0 | 噴火・失敗 |

失敗条件を成功条件より先に評価し、危険状態を成功と表示しない。

## Phase 4 — Interactive UI

`app/VolcanoLab.tsx` と `app/globals.css` に以下を実装した。

- 3スライダー
- 火山断面SVG
- 圧力指数と警戒状態
- ミッションカード
- 噴火演出
- リセット
- 因果関係の解説
- GPTシナリオ生成フォーム
- 生成シナリオ用の汎用因果マップ
- モバイルレイアウト
- キーボードフォーカス
- `aria-live`
- `prefers-reduced-motion`

## Phase 5 — GPT-5.6 integration

`POST /api/scenario` からOpenAI Responses APIを呼び出す。

- Model: `gpt-5.6`
- Strict Structured Outputs
- 入力: `theme`, `audience`, `learningGoal`
- 入力サイズ上限: 4 KiB
- 簡易IPレート制限: 3 requests / 5 minutes
- サーバー指示とユーザー入力を分離
- Zodで入力と生成結果を再検証
- 自己参照、範囲外値、不正ID、複雑すぎるASTを拒否
- APIキー未設定時は明示的な503
- 生成成功時は同じローカルエンジンへ安全に適用

Structured Outputs用JSON SchemaはZodから生成し、標準モデルで非対応の `minLength` / `maxLength` だけをAPI送信前に除外する。文字列長は戻り値のZod再検証で保証する。

## Phase 6 — Branding and OG

- 正式名称: WhyMorph
- メタデータ、画面、パッケージ、文書へ反映
- 承認済み最終画像を `public/og.png` へ採用
- 採用前の画像を `public/og-pre-whymorph.png` として保持
- Open Graph / X metadataは `/og.png` を参照
- 追加の画像生成は行わない

## Problems and fixes

### Internal ID format mismatch

火山シナリオの内部IDがハイフン形式、GPT安全スキーマがsnake_case形式だったため、Zod整合テストが失敗した。

Fix: ローカルIDを `shinmoe_observatory` / `stabilize_chamber` へ統一し、14件すべてのテストを通した。

### Structured Outputs schema compatibility

Zodの文字列長制約がJSON Schemaの `minLength` / `maxLength` へ変換され、再帰的なdiscriminated unionが `oneOf` になることを確認した。GPT-5.6のStructured Outputsはこの `oneOf` を拒否した。

Fix: APIへ送るスキーマから文字列長制約を除去し、`oneOf` を公式仕様で対応する `anyOf` へ再帰変換した。サーバー側Zod検証は維持し、変換処理の回帰テストを追加した。生成時は `reasoning.effort: none` を指定し、品質を保ちながら待ち時間を短縮した。

### Unused starter code

初期テンプレートのプレビューとD1/Drizzle雛形がMVPで未使用のまま型検査対象になっていた。

Fix: WhyMorph内だけから未使用プレビューとDB雛形を削除し、依存も除外した。アプリとSites workerに必要な部分は保持した。

### Workspace location

実装途中でCodexの生成作業フォルダーを使用していたが、ユーザー指定により最初の提供フォルダーだけへ作業範囲を限定した。

Fix: 既存準備資料を上書きせず、指定フォルダー内の `WhyMorph/` へプロジェクトを移行。以後のインストール、編集、テスト、ビルドはすべてそこで実行した。プロジェクト外の途中フォルダーは変更・削除していない。

## Commands and verified results

2026-07-18:

| Command / check | Result |
|---|---|
| `npm ci --cache .\work\npm-cache` | PASS |
| `npm test` | PASS — 15 / 15 |
| `npm run typecheck` | PASS — 0 errors |
| `npm run lint` | PASS — 0 warnings / errors |
| `npm run build` | PASS |
| `GET /` | HTTP 200 |
| `GET /og.png` | HTTP 200, 1,948,308 bytes |
| `POST /api/scenario` without key | HTTP 503 with `SERVER_MISCONFIGURED` |
| GPT-5.6 minimal API authentication check | HTTP 200, `gpt-5.6-sol` |
| GPT-5.6 live scenario generation | HTTP 200, 27.5 seconds |
| approved OG source vs `public/og.png` | SHA-256 match |

## 2026-07-20 — 火山ビジュアルのリアル化

- PBR岩肌・地層・火道・マグマだまりを備えた写実的な「噴火直前」火山断面を追加
- 同じ構図を維持した写実的な「噴火開始」フレームを追加し、噴火条件成立時だけ自然に切り替え
- マグマ量・ガス圧力・火道閉塞率に応じて、マグマ光、火道発光、噴煙、閉塞表現が連動
- 噴火時の炎をCSS図形で描かず、実在感のある溶岩噴出・火山灰・火の粉を使用
- 噴火警告を左上の小型パネルへ移し、火山内部を覆わない配置へ変更
- ページの見出し、操作部、計器、警戒表示、文字サイズは完成時の構成を維持
- `npm test`（15件）、`npm run typecheck`、`npm run lint`、`npm run build` がすべて成功

## 2026-07-20 — 回答・根拠・レベル5・テーマ画像

- 噴火条件と警戒表示の不一致を修正。通常状態はレベル1〜4、閾値イベント成立時は同じ条件から必ずレベル5を返す
- GPT生成テーマに「質問への回答」「数値化の考え方」「教育用の仮定」「モデル信頼度と理由」を追加
- Responses APIのWeb searchを必須にし、出典はモデル生成URLではなくツール出力のHTTPS URLだけを最大5件表示
- GPT Image 2で、同一構図の通常状態と結果状態を1枚の写実的な比較画像としてテーマ生成時に作成
- スライダー操作時は画像APIを再実行せず、安全な決定論エンジンの閾値に応じて2状態を切り替える
- 画像生成だけ失敗した場合は、回答とシミュレーションを維持して既存の因果マップへ戻す
- 生成画像は各状態3:2を保つ比較画像として表示し、狭い画面でも伸縮変形させない
- 高コストな匿名生成を5分あたり3回/IPへ制限（分散環境では永続制限が今後必要）
- ローカル火山モデルに係数、閾値、仮定、公的警戒レベルとの違い、参考資料を明示
- 承認済みOG画像と既存の火山画像は変更していない
- 生成ASTでは除算を禁止し、不正なclamp範囲と過大な数値を拒否。さらに初期値と全端点をサーバーで試算してから返す
- `npm test`（18件）、`npm run typecheck`、`npm run lint`、`npm run build` が成功
- ローカル実通信でGPT-5.6回答、通常段階4件、Web検索の実出典5件、GPT Image 2のWebP画像を確認

## 2026-07-21 — クモ糸×飛行機の体験型シミュレーション

> この節は公開済み旧版の履歴です。200 kg模型・5入力・0.75 m閾値のモデルは、同日の科学監査で不適切と判定し、後続の「科学監査と実物旅客機モデルへの置換」で廃止しました。

- WhyMorph内の2つ目のローカル体験として「小さなクモの糸で飛行機を動かせるか？」を追加
- 既存の火山・GPT生成エンジン・Zodスキーマ・画像処理を変更せず、火山の回帰リスクを限定
- `app/data/spider-plane.ts` に5入力の範囲、初期値、判定順、状態文言を宣言データとして分離
- すべての入力を有限値と許容範囲へ制限し、計算は型付き純関数だけで実行。`eval` / `Function` は不使用
- 糸の本数、1本あたりの強さ、1本あたりの引く力、飛行機モデルの質量、地面との摩擦を大きなスライダーで操作
- 3秒後の簡略移動距離を、合計引力・摩擦力・質量から決定論的に計算
- 「動かない」「少し動く」「動いた！」「糸が切れた！」の4状態を実装
- 飛行機SVGを条件に応じて実際に横移動させ、切断時は糸を左右の線分へ分離し、火花と赤い警告を表示
- 必要な糸の本数、合計強度、合計引力、摩擦力、最も影響した条件を即時表示
- なぜ動かない・動いた・切れたかを短い式と説明で常時表示
- 4状態へ直接移れるデモボタンとリセットを追加し、手動スライダー操作も維持
- 既存の全体 `prefers-reduced-motion` ルールを移動・切断アニメーションへ適用
- 390px幅で横スクロールが発生しないことをブラウザ確認
- ブラウザ実測で、初期位置に対して「少し動く」は約8px、「動いた！」は約100px移動
- 切断時は接続線0本、分離した線・火花7パスへ切り替わることをDOMと目視で確認
- 火山の初期値76 / 82 / 72、圧力80.9、警戒レベル4、写実画像が維持されることを確認
- 自動テストを18件から28件へ拡張し、既存テストを含めすべて成功
- `npm test`（28件）、`npm run typecheck`、`npm run lint`、`npm run build` がすべて成功
- 既存のWhyMorph Sites公開先へ反映し、公開URLで新しい体験を利用できる状態に更新

飛行機モデルのデモ値:

| 状態 | 糸 | 強さ/本 | 引く力/本 | 質量 | 摩擦 | 結果 |
|---|---:|---:|---:|---:|---:|---|
| 初期 | 1本 | 12N | 5N | 200kg | 2% | 動かない・必要8本 |
| 少し移動 | 6本 | 12N | 7N | 200kg | 2% | 3秒で0.063m |
| 大きく移動 | 20本 | 12N | 7N | 200kg | 2% | 3秒で2.268m |
| 切断 | 20本 | 12N | 15N | 200kg | 2% | 1本の強さを超過 |

この数値は因果関係を理解するための教育用設定であり、実際の航空機・クモ糸の厳密な工学計算ではないことを画面とREADMEへ明記した。

## 2026-07-21 — 科学監査と実物旅客機モデルへの置換

### 監査

- 現行版 `d7e0f10`、Git全履歴、reflog、未参照オブジェクト、保存パッケージ8件、`public/` を読み取り監査
- 飛行機専用機能は `0eeee3b` で初めて追加され、直前 `65f4bff` には飛行機専用UIも画像も存在しないことを確認
- 以前の写実画像はGPT Image 2がセッション内data URLとして返した一時画像と考えられ、ファイル・生成ID・出典・権利記録がなく復元不能
- 旧版の式 `本数×引く力`、`質量×9.8×摩擦率`、3秒後の距離、0.75 m閾値、画面ピクセル変換には、実物旅客機を動かす根拠がなかった
- 旧版は最小条件で糸1本または2本でも機体を動かせ、初期質量200 kgの模型計算と旅客機風表示が矛盾していた
- 修正前の状態を `codex/spider-pre-science-audit`、修正作業を `codex/spider-science-model` に分離

### 新しい対象と出典

- 対象: 実物旅客機 `Boeing 737-8`
- 初期質量: 82,871 kg。Boeing公式 `737 MAX Airplane Characteristics Rev K` の最大設計タキシー質量（仕様表の上限）
- 写真は同型機の代表視覚であり、撮影時質量が82,871 kgだったとは扱わない
- クモ糸はWu et al. (2018)のNephila pilipesドラグライン測定範囲、直径8〜11 µm・引張強度800〜1,100 MPaを使用
- 標準重力9.80665 m/s²はNIST、転がり抵抗係数0.02はFAA掲載資料の乾燥路面・無制動タイヤ範囲を参照
- 目標加速度0.02 m/s²、安全率3、固定効率0.5、傾斜範囲、本数上限は根拠値と混同せず「教育用仮定」として表示

### 入力範囲の監査表

| 入力 | 最小 | 初期 | 最大 | 刻み | 出典または仮定 |
|---|---:|---:|---:|---:|---|
| 質量 | 60,000 kg | 82,871 kg | 82,871 kg | 1 kg | 上限・初期はBoeing公式。下限は教育用感度比較 |
| 転がり抵抗係数 | 0.015 | 0.020 | 0.020 | 0.001 | FAA掲載資料の一般範囲。737-8固有値ではない |
| 傾斜 | 0° | 0° | 1.15° | 0.05° | 約0〜2%勾配の教育用UI範囲 |
| 目標加速度 | 0.001 m/s² | 0.020 m/s² | 0.050 m/s² | 0.001 m/s² | 低速比較用の教育仮定 |
| 糸直径 | 8 µm | 10 µm | 11 µm | 0.1 µm | Wu et al. (2018) |
| 引張強度 | 800 MPa | 1,000 MPa | 1,100 MPa | 10 MPa | Wu et al. (2018) |
| 安全率 | 1 | 3 | 10 | 0.1 | 教育用仮定 |
| 固定効率 | 0 | 0.5 | 1 | 0.05 | 教育用仮定。0は固定不能 |
| 糸本数 | 1本 | 1本 | 100,000,000本 | 1本 | 整数。最大はUI・計算上限 |

### SI物理モデル

```text
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
requiredThreadCount = ceil(requiredForce / safeForcePerThread)
```

破断状態は、牽引側が必要牽引力まで張力をゆっくり増やす試行を仮定する。破断力に達する前に止めた場合は、糸は切れず機体も動かない。固定効率0は破断と混同せず、固定部が力を伝えない独立状態として扱う。

判定順:

```text
attachmentEfficiency = 0
  → 固定部が力を伝えられない。糸は破断せず、機体変位0

requiredForce > bundleBreakingForce
  → 糸が先に破断、機体変位0

破断しないが requiredForce > bundleSafeForce
  → 安全率不足、機体変位0

threadCount >= requiredThreadCount かつ破断しない
  → 簡略モデル内でだけ模式移動
```

`requiredThreadCount` は安全使用力から算出するため、本数が必要本数以上なのに同じ必要力で破断する状態は数学的に発生しない。将来の拡張で矛盾した中間状態が入っても、固定不能を先に、次に破断を判定し、どちらも移動を拒否する独立安全ゲートを追加した。

### 初期値の独立計算

| 項目 | 計算結果 |
|---|---:|
| 転がり抵抗 | 16,253.737843 N |
| 傾斜力 | 0 N |
| 加速力 | 1,657.42 N |
| 必要牽引力 | 17,911.157843 N |
| 糸断面積 | 7.853981633974483 × 10^-11 m² |
| 糸1本の破断力 | 0.0785398163 N |
| 固定後の有効破断力 | 0.0392699082 N |
| 糸1本の安全使用力 | 0.0130899694 N |
| 破断回避の最少本数 | 456,104本 |
| 安全率を満たす必要本数 | 1,368,312本 |

この結果をアプリ計算と独立した固定値テストで比較し、丸め前の値が一致することを確認した。

### UI・視覚・権利

- 旧インラインSVG旅客機を削除し、地上走行中の実写737-8へ置換
- 写真: “Singapore Airlines Boeing 737 9V-MBA Singapore 2025 (02)”, Bahnfrend, Wikimedia Commons, CC BY-SA 4.0
- 原JPEGのバイト列は変更せず、実写写真の機体領域をインラインSVGマスクで切り抜いた派生表示と、同写真による静止背景を重ねた。派生表示もCC BY-SA 4.0を維持
- 条件成立時に動くのは機体領域レイヤーだけで、背景は静止。移動量はデスクトップ18 px、モバイル8 pxの模式表現
- 作者、元ページ、ライセンス、加工内容を画面とREADMEへ表示
- 糸は5本の高コントラスト線で束として表示し、実際の本数を常時数値表示
- 「視認性のため実際より太く描画」「多数は束で表示」「移動演出は距離・時間の縮尺ではない」を明記
- `計算を見る` に式、代入値、SI変換、途中計算、結果、出典・仮定を表示
- 指定の免責文を画面へ正確に表示
- 状態・説明・主要計算値を1つのライブリージョンとして読み上げ、モバイルの視覚注記と権利表記を10 px以上へ拡大

### 回帰境界

- 変更対象を `app/data/spider-plane.ts`、`app/SpiderPlaneLab.tsx`、`.spider-*` CSS、専用テスト、文書、権利確認済み写真へ限定
- `app/data/volcano.ts`、`app/lib/simulation.ts`、`app/api/scenario/route.ts`、GPT生成スキーマ、火山画像、OG画像は変更していない
- 雨・津波はGit履歴に固定fixture／保存アセットがなく、専用画面の回帰は未検証。共有コードが今回の差分外であることと、共通GPT生成経路の既存テストが通ることだけを確認する
- ユーザー確認前の公開を禁止し、この修正版はローカル検証までに留める

### 検証

- `npm test`: PASS — 38 / 38
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS
- Local GET `/`: HTTP 200
- Local GET `/boeing-737-taxi-cc-by-sa-4.jpg`: HTTP 200、3,816,392 bytes
- ブラウザ: 1本・2本は破断／機体変位0
- ブラウザ: 456,104本は破断回避／安全率不足／機体変位0
- ブラウザ: 1,368,311本は安全率不足／機体変位0
- ブラウザ: 1,368,312本は破断なし／条件成立／機体18 px模式移動（モバイルは8 px）
- ブラウザ: 破断時は左右5本ずつ計10線分、非破断時は5本の束、実数ラベルを確認
- ブラウザ: `計算を見る` の10項目、µm→m変換、必要本数式を確認
- ブラウザ: 質量0を拒否し、既存の有効状態を維持して画面全体が壊れないことを確認
- ブラウザ: 390 px幅で横スクロールなし、実写・状態・糸束・本数・結果カードに見切れなし
- ブラウザconsole: warning / error 0件
- 火山UI: 76 / 82 / 72、圧力80.9、警戒4、写実画像を維持
- GPT生成フォーム: theme / audience / learning-goalの3入力を維持
- 公開サイトへのデプロイ: 未実施（ユーザー確認待ち）

Build routes:

```text
/               page
/api/scenario   API
```

## Work completed with Codex

- 提供資料と提出条件の確認
- OpenAI公式ドキュメントに基づくResponses API / GPT-5.6仕様確認
- アーキテクチャと安全なAST設計
- UI、シミュレーション、API、スキーマ実装
- OG画像の生成・改善・承認後反映
- 型検査・自動テスト・本番ビルド
- セキュリティと秘密情報の確認
- README、Build Log、公開準備

## Current limitations

- GPT生成用の汎用ASTは変数キー3種類、派生指標1種類（ローカル飛行機体験は型付き9入力モデル）
- 時間発展・確率モデルなし
- ユーザー認証と永続化なし
- インメモリのレート制限は分散環境の厳密な上限ではない
- GPT生成には実行環境ごとの `OPENAI_API_KEY` が必要（公開環境は設定済み）
- 教育用モデルであり、専門判断や防災判断には使用不可

## Remaining work

- 東京イベント提出とDevpost提出

## 2026-07-22 — before-rain-lightning 安全チェックポイント

雨・雷の実装には着手せず、現在の正常な火山を保護する準備と回帰確認だけを実施した。

### Git復元点

- 確認開始時の作業ツリー: clean（未コミット変更なし）
- バックアップコミット: `79f34ffeae99037249c36a434138a2f56e30f489`
- 復元用annotated tag: `before-rain-lightning`
- 元の正常ブランチ: `codex/spider-science-model`
- 準備作業ブランチ: `feature/rain-lightning`
- GitHub push、Sitesデプロイ、`reset --hard`、force push、履歴書き換えは未実施

### 火山関連ファイル

直接実装・アセット:

- `app/VolcanoLab.tsx`
- `app/data/volcano.ts`
- `public/volcano-real-v2.png`
- `public/volcano-erupting-v2.png`

共有経路・回帰テスト:

- `app/page.tsx`
- `app/globals.css`
- `app/lib/simulation.ts`
- `app/lib/scenario-schema.ts`
- `app/api/scenario/route.ts`
- `tests/simulation.test.ts`
- `tests/spider-plane.test.ts`（火山状態への副作用がないことを確認する回帰を含む）

### ブラウザでの火山確認

| 操作 | マグマ量 | ガス圧力 | 火道の詰まり | 圧力指数 | 警戒状態 | 噴火 |
|---|---:|---:|---:|---:|---|---|
| 初期表示 | 76 | 82 | 72 | 80.9 | レベル4・緊急 | なし |
| 3値を最大へ操作 | 100 | 100 | 100 | 100.0 | レベル5・事象発生 | `噴火発生` |
| `初期値`を押してリセット | 76 | 82 | 72 | 80.9 | レベル4・緊急 | なし |

- 写実火山断面、煙、マグマ、火道、警戒表示を目視確認
- 噴火時に結果表示、警戒レベル5、ミッション失敗へ連動することを確認
- リセット後に3入力、圧力、警戒、噴火状態が初期値へ戻ることを確認
- ブラウザconsoleのwarning / error: 0件

### 失敗時の非破壊な復元手順

作業途中の内容を失わず元ブランチへ戻る場合:

```powershell
git status --short
git add -A
git commit -m "WIP: preserve rain-lightning attempt"
git switch codex/spider-science-model
git rev-parse HEAD
```

最後の出力が `79f34ffeae99037249c36a434138a2f56e30f489` であることを確認する。

タグから完全に独立した復元ブランチを作る場合:

```powershell
git switch -c restore/before-rain-lightning before-rain-lightning
git rev-parse HEAD
```

この手順は既存ブランチを上書きせず、`reset --hard` やforce操作も使用しない。

## 2026-07-22 — 雨・雷の操作型シミュレーション

`before-rain-lightning` を復元点とし、`feature/rain-lightning` 上で雨と雷を同時に実装した。GitHub pushとSitesデプロイは行っていない。

### 火山の保護境界

- `app/data/volcano.ts`、`app/lib/simulation.ts`、`app/lib/scenario-schema.ts`、`tests/simulation.test.ts`、`public/volcano-real-v2.png`、`public/volcano-erupting-v2.png`、`app/globals.css` は変更していない
- 上記保護対象は `before-rain-lightning` との差分が0件
- `app/VolcanoLab.tsx` は公開シェル部分だけを変更し、火山の入力・計算・状態判定・画像・警戒表示・リセット部分は変更していない
- 公開シェルの変更は、雨・雷のimport、ナビゲーション、紹介文、体験カード、挿入位置、GPT入力例だけ

### 雨・雷モデル

直接入力は0〜100へ制限した次の3つ。

- 空気中の水蒸気量 `waterVapor`
- 大気の不安定さ `instability`
- 上昇気流の強さ `updraft`

派生値は入力から決定論的に計算し、直接操作させない。

- 凝結しやすさ
- 雲の発達度
- 雨滴・氷晶の成長度
- 降水強度
- 氷相発達度
- 電荷分離度
- 雷発生可能性

正規化値を `w / i / u` とした固定式:

```text
condensation = w × (0.65u + 0.35i)
cloud = condensation × (0.45 + 0.30i + 0.25u)
particle = cloud × (0.50w + 0.30u + 0.20i)
precipitation = particle × (0.55cloud + 0.25w + 0.20u)
ice = cloud × ramp(instability, 30) × ramp(updraft, 35)
charge = ice × ramp(updraft, 45) × (0.55i + 0.45cloud)
lightningPotential = charge × (0.55ice + 0.25u + 0.20i)
```

すべて0〜100へ制限して小数1桁へ丸める。水蒸気だけ、上昇気流だけでは凝結・降水・雷が成立しない。状態判定に乱数、`eval`、`Function`は使用しない。

名前付き閾値:

- 雲のでき始め: 凝結8、雲6
- 雲の発達: 凝結25、雲30、不安定さ35または上昇気流45
- 雨: 雲35、粒28、降水20
- 強い雨: 雲55、粒60、降水55
- 雷雲: 雲60、氷相45、電荷30、不安定さ70、上昇気流70
- 雷発生: 雲70、氷相65、電荷55、雷発生可能性50、不安定さ85、上昇気流85

状態は複数条件で判定し、雷を雨の固定された次段階にはしていない。強い雨 `100 / 60 / 100` は雷なし、`90 / 90 / 90` は放電なし雷雲、`95 / 95 / 95` でのみ雷発生になる。

### UIと視覚

- `RainLightningLab` を火山から独立したクライアントコンポーネントとして追加
- CSS Moduleと `wx` 接頭辞だけを使い、火山のグローバルCSSへ影響させない
- 大きなスライダーと0〜100数値入力を同期
- 雲は本体、塔状部、金床状上部、暗い雲底の非対称4層で半リアルに表現
- 雲の発達度と上昇気流に応じて雲の大きさ・縦方向の発達・暗さを変更
- 降水成立時のみ固定配列の雨粒を生成し、雨24本、強い雨54本へ増加
- 雷雲時だけ `＋ 正電荷` と `− 負電荷` を表示
- 電位差メーター（物理的電圧ではない教育用代理指標）を `role="meter"` で表示し、目安50を明示
- 雷成立時だけ約8.8秒周期の短い稲妻を表示し、全画面フラッシュを使用しない
- `prefers-reduced-motion` では雨粒の移動と稲妻の点滅を止め、静止表現へ変更
- 教育用簡略モデル、予報利用禁止、雷の帯電過程に研究中の部分があることを画面へ明記

### 飛行機テーマの非公開化

- `SpiderPlaneLab` のimportと描画を公開シェルから削除
- ナビゲーション、体験カード、ヒーロー説明、GPT入力例から飛行機を削除
- `app/SpiderPlaneLab.tsx`、`app/data/spider-plane.ts`、専用CSS、写真アセット、テストは開発用として保持
- 公開利用者は飛行機テーマを選択できない

### ブラウザ確認

雨・雷:

| 入力（水蒸気 / 不安定さ / 上昇気流） | 状態 | 雨粒 | 電荷 | 稲妻 | 雷発生可能性 |
|---|---|---:|---:|---:|---:|
| 100 / 0 / 0 | 晴れ | 0 | なし | なし | 0 |
| 0 / 100 / 0 | 晴れ | 0 | なし | なし | 0 |
| 0 / 0 / 100 | 晴れ | 0 | なし | なし | 0 |
| 50 / 30 / 35 | 雲ができ始める | 0 | なし | なし | 0 |
| 70 / 50 / 70 | 雲が発達する | 0 | なし | なし | 0.3 |
| 90 / 60 / 80 | 雨 | 24 | なし | なし | 2.4 |
| 100 / 60 / 100 | 強い雨 | 54 | なし | なし | 11.9 |
| 90 / 90 / 90 | 雷雲 | 54 | あり | なし | 27.1 |
| 95 / 95 / 95 | 雷発生 | 54 | あり | あり | 52.8 |

- 条件を下げると雷→強い雨→雨→発達した雲→雲のでき始め→晴れへ戻ることを確認
- リセットで `20 / 20 / 15`、晴れ、雨なし、雷なしへ戻ることを確認
- 390px幅でページ・雨セクションとも横スクロールなし
- 入力、現在状態、雲、派生値、不足条件が1列で見切れないことを確認
- ブラウザのconsole warning / errorは0件

火山:

| 操作 | マグマ / ガス / 閉塞 | 圧力 | 警戒 | 噴火 |
|---|---:|---:|---:|---|
| 初期 | 76 / 82 / 72 | 80.9 | 4 / 噴火切迫レベル | なし |
| すべて最大 | 100 / 100 / 100 | 100.0 | 5 / 噴火発生 | あり |
| リセット後 | 76 / 82 / 72 | 80.9 | 4 / 噴火切迫レベル | なし |

- 3スライダー、警戒状態、噴火、リセットを実ブラウザで確認
- 390px幅で横スクロールなし、既存の写実火山断面と警戒表示を目視確認

### 最終検証

- `npm run typecheck`: 成功
- `npm test`: 55 / 55 成功
- 独立監査で、雲を支えるOR条件の両側境界、雷発生可能性50.0ちょうど、説明文の不足ゲート一致を修正・固定する回帰テストを追加
- 空の場面を `role="group"`、状態をatomicな `role="status"` とし、内側の `role="meter"` を支援技術から利用できる構造へ修正
- `npm run lint`: 成功
- `npm run build`: 成功
- `.env.local` はGit追跡外
- `sk-` 形式の秘密情報は追跡ファイルに0件
- `OPENAI_API_KEY` の検索一致は、環境変数参照、空の設定例、設定手順、未設定テストだけで、キー値の直書きはない
- GitHub push: 未実施
- Sitesデプロイ: 未実施

### 変更ファイル

- `app/VolcanoLab.tsx`
- `app/RainLightningLab.tsx`
- `app/RainLightningLab.module.css`
- `app/data/rain-lightning.ts`
- `tests/rain-lightning.test.ts`
- `README.md`
- `PLANS.md`
- `BUILD_LOG.md`

### 非破壊の復元手順

現在の作業を保存してから、復元タグから別ブランチを作る。

```powershell
git status --short
git add -A
git commit -m "WIP: preserve rain-lightning implementation"
git switch -c restore/before-rain-lightning before-rain-lightning
git rev-parse HEAD
```

復元先の期待commitは `79f34ffeae99037249c36a434138a2f56e30f489`。`reset --hard`、force push、履歴書き換えは不要。

