# WhyMorph

> 「なぜ？」を、操作できる学びへ。

WhyMorphは、GPT-5.6が自由な学習テーマを、変数を動かして因果関係を確かめられる教育シミュレーションへ変換するWebアプリです。

OpenAI Build Week Tokyo（2026-07-18）で制作しました。最初から遊べる火山危機管理シナリオに加え、テーマ・対象・学習ゴールを入力すると、GPT-5.6が新しいシナリオを構造化データとして生成し、同じ安全なローカルエンジンで実行します。

## Problem

複雑な現象は、文章や静止画だけでは「どの要因が、どの結果へつながるか」を直感的に理解しにくいものです。また、題材ごとに専用シミュレーターを作るには時間と専門知識が必要です。

## Solution

WhyMorphは学習テーマを次の流れへ変換します。

```text
学びたいテーマを入力
→ GPT-5.6が変数・派生値・条件・ミッションを構造化
→ サーバーがZodで安全性を再検証
→ 決定論的なローカルエンジンで実行
→ 学習者が変数を操作し、因果関係を発見
```

生成された文字列をコードとして実行せず、許可済みの数値・条件ASTだけを評価します。

## Demo

公開URLはデプロイ完了後に追記します。

### 30秒の火山デモ

1. 初期状態を確認します。

   - マグマ量: `76`
   - ガス圧力: `82`
   - 火道の詰まり: `72`
   - 圧力指数: `80.9`
   - 警戒状態: 高

2. ガス圧力と火道の詰まりを下げると、圧力指数と警戒状態が即時に変わります。
3. `30 / 40 / 35` では圧力指数が `36.5` となり、安定化ミッションに成功します。
4. すべてを `100` にすると圧力指数は `100` となり、噴火条件と失敗判定を確認できます。
5. 「テーマから生成」で別の学習テーマをGPT-5.6の因果シミュレーションへ変換します。

> 火山モデルは教育・体験用です。実際の噴火予測や避難判断には使用できません。

## Main features

- 3変数を操作するリアルタイム因果シミュレーション
- 火山断面、圧力指数、警戒状態、ミッション結果の連動表示
- GPT-5.6による任意テーマのシナリオ生成
- GPT生成シナリオを同じ汎用エンジンへ安全に切り替え
- 入力制限、簡易レート制限、厳密な生成結果検証
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

## Architecture

```text
Browser
  ├─ VolcanoLab UI
  ├─ sliders / causal map / missions
  └─ POST /api/scenario
          ↓
Server route
  ├─ request validation
  ├─ rate limiting
  ├─ OpenAI Responses API (gpt-5.6)
  ├─ strict Structured Outputs
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

サーバー側でのみ `OPENAI_API_KEY` を使用し、Responses APIの `gpt-5.6` とStrict Structured OutputsでシナリオJSONを生成します。生成結果はZodによる構造・範囲・参照整合性の検証を通過した場合だけブラウザへ返します。

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

2026-07-18のローカル検証:

- Unit/API tests: 14 / 14 passed
- TypeScript: passed
- Production build: passed
- GET `/`: HTTP 200
- GET `/og.png`: HTTP 200
- API key未設定時の `POST /api/scenario`: 明示的なHTTP 503

## Accessibility

- すべてのレンジ入力にラベルと現在値を付与
- 状態変化を `aria-live` で通知
- キーボードフォーカスを可視化
- 色だけに依存せず数値・ラベル・説明を併用
- モバイル向けレイアウト
- 動きを減らすOS設定を尊重

## How Codex was used

Codexを共同開発者として、資料確認、公式OpenAI仕様の検証、アーキテクチャ設計、実装、テスト、OG制作、セキュリティ確認、公開準備に使用しました。生成コードは型検査・自動テスト・本番ビルドで検証し、重要な設計判断は `BUILD_LOG.md` に記録しています。

## Key decisions

- 火山専用UIをMVPとして完成させつつ、エンジンは任意テーマへ再利用可能にする
- GPTは構造化シナリオを作り、結果計算は決定論的エンジンへ任せる
- AI生成コードを実行しない
- GPT障害時もローカルMVPを使えるようにする
- プロジェクト名は承認済みのWhyMorphへ統一する
- 最終OGは承認済み画像を採用し、旧版を別名で保持する

## Limitations

- 制御変数キーは現在3種類、派生指標は1種類に固定
- 時間発展・確率モデル・永続化・ユーザー認証は未実装
- 生成シナリオは教育用の簡易モデルで、専門判断には使用不可
- インメモリのレート制限は分散環境で厳密な全体上限にはならない
- GPT実通信には実行環境ごとの `OPENAI_API_KEY` 設定が必要

## Future work

- 生成前後の因果マップ差分プレビュー
- 教員による承認・編集フロー
- 複数ミッションと学習履歴
- 学年・理解度に合わせた説明
- 物理・生物・地学・経済などのテンプレート集
- 永続的な分散レート制限

## Third-party libraries and licenses

各依存パッケージはそれぞれのライセンスに従います。プロジェクトの依存バージョンは `package-lock.json` で固定しています。

## License

MIT。詳細は `LICENSE` を参照してください。

