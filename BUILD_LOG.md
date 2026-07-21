# WhyMorph — Build Log

- Event: OpenAI Build Week Tokyo
- Date: 2026-07-18
- Status: MVP built, verified, and publicly deployed
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

- GPT生成用の汎用ASTは変数キー3種類、派生指標1種類（ローカル飛行機体験は型付き5変数モデル）
- 時間発展・確率モデルなし
- ユーザー認証と永続化なし
- インメモリのレート制限は分散環境の厳密な上限ではない
- GPT生成には実行環境ごとの `OPENAI_API_KEY` が必要（公開環境は設定済み）
- 教育用モデルであり、専門判断や防災判断には使用不可

## Remaining work

- 東京イベント提出とDevpost提出

