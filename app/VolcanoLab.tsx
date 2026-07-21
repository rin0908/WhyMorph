"use client";

import type { CSSProperties, FormEvent } from "react";
import { useMemo, useState } from "react";
import { SpiderPlaneLab } from "./SpiderPlaneLab";
import { VOLCANO_SCENARIO } from "./data/volcano";
import { ScenarioDefinitionSchema } from "./lib/scenario-schema";
import type {
  ScenarioDefinition,
  SimulationState,
  VariableKey,
} from "./lib/simulation";
import {
  createInitialSimulationState,
  evaluateSimulation,
  resetSimulation,
  setSimulationVariable,
} from "./lib/simulation";

const KEYS = ["magma", "gas", "blockage"] as const;
type GenStatus = "idle" | "loading" | "success" | "error";

interface SourceLink {
  readonly title: string;
  readonly url: string;
}

interface GeneratedVisual {
  readonly dataUrl: string;
  readonly alt: string;
}

interface GeneratedPayload {
  readonly scenario: ScenarioDefinition<string>;
  readonly sources: readonly SourceLink[];
  readonly visual: GeneratedVisual | null;
}

const LOCAL_SCENARIO =
  VOLCANO_SCENARIO as unknown as ScenarioDefinition<string>;

const LOCAL_SOURCES: readonly SourceLink[] = [
  {
    title: "気象庁：各種の火山観測",
    url: "https://www.jma.go.jp/jma/kishou/know/kazan/volmonita/volmonita.html",
  },
  {
    title: "USGS：Volcanic gases",
    url: "https://www.usgs.gov/programs/VHP/volcanic-gases-can-be-harmful-health-vegetation-and-infrastructure",
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function safeSource(value: unknown): SourceLink | null {
  if (!isRecord(value)) return null;
  if (typeof value.title !== "string" || typeof value.url !== "string") {
    return null;
  }
  try {
    const url = new URL(value.url);
    if (url.protocol !== "https:") return null;
    return { title: value.title, url: url.href };
  } catch {
    return null;
  }
}

function generatedPayloadFrom(body: unknown): GeneratedPayload | null {
  if (!isRecord(body) || !isRecord(body.scenario)) return null;
  const parsed = ScenarioDefinitionSchema.safeParse(body.scenario);
  if (!parsed.success) return null;

  const evidence = isRecord(body.evidence) ? body.evidence : null;
  const sources =
    evidence && Array.isArray(evidence.sources)
      ? evidence.sources
          .map(safeSource)
          .filter((source): source is SourceLink => source !== null)
          .slice(0, 5)
      : [];

  const visualCandidate = isRecord(body.visual) ? body.visual : null;
  const visual =
    visualCandidate &&
    typeof visualCandidate.dataUrl === "string" &&
    visualCandidate.dataUrl.startsWith("data:image/webp;base64,") &&
    typeof visualCandidate.alt === "string"
      ? {
          dataUrl: visualCandidate.dataUrl,
          alt: visualCandidate.alt,
        }
      : null;

  return {
    scenario: parsed.data as ScenarioDefinition<string>,
    sources,
    visual,
  };
}

function apiErrorMessage(body: unknown) {
  if (!isRecord(body) || !isRecord(body.error)) return null;
  return typeof body.error.message === "string"
    ? body.error.message
    : null;
}

export function VolcanoLab() {
  const [scenario, setScenario] =
    useState<ScenarioDefinition<string>>(LOCAL_SCENARIO);
  const [state, setState] = useState<SimulationState<string>>(() =>
    createInitialSimulationState(LOCAL_SCENARIO),
  );
  const [theme, setTheme] = useState("");
  const [audience, setAudience] = useState("中学生");
  const [learningGoal, setLearningGoal] = useState(
    "原因と結果の関係を、変数を操作しながら理解したい",
  );
  const [gen, setGen] = useState<GenStatus>("idle");
  const [genTitle, setGenTitle] = useState<string | null>(null);
  const [genMessage, setGenMessage] = useState("");
  const [sources, setSources] =
    useState<readonly SourceLink[]>(LOCAL_SOURCES);
  const [scenarioVisual, setScenarioVisual] =
    useState<GeneratedVisual | null>(null);

  const result = useMemo(
    () => evaluateSimulation(scenario, state),
    [scenario, state],
  );
  const derivedValue = result.derived.pressure;
  const derivedSpec = scenario.derived.pressure;
  const derivedRatio = Math.max(
    0,
    Math.min(
      1,
      (derivedValue - derivedSpec.min) /
        (derivedSpec.max - derivedSpec.min || 1),
    ),
  );
  const derivedDisplay = derivedValue.toFixed(derivedSpec.precision);
  const values = state.variables;
  const isVolcano = scenario.id === VOLCANO_SCENARIO.id;
  const style = {
    "--alert": result.alert.color,
    "--pressure": String(derivedRatio * 360) + "deg",
    "--og-magma-glow": String(0.02 + values.magma / 520),
    "--og-conduit-glow": String(0.01 + values.magma / 700),
    "--og-magma-scale": String(0.82 + values.magma / 500),
    "--og-magma-dim": String(Math.max(0.06, 0.68 - values.magma / 160)),
    "--og-smoke-opacity": String(0.015 + values.gas / 420),
    "--og-smoke-scale": String(0.68 + values.gas / 220),
    "--og-blockage-opacity": String(0.08 + values.blockage / 112),
    "--og-blockage-scale": String(0.58 + values.blockage / 190),
  } as CSSProperties;

  function update(key: VariableKey, value: number) {
    setState((current) =>
      setSimulationVariable(scenario, current, key, value),
    );
  }

  function restoreCurrentScenario() {
    setState(resetSimulation(scenario));
  }

  function restoreLocalDemo() {
    setScenario(LOCAL_SCENARIO);
    setState(createInitialSimulationState(LOCAL_SCENARIO));
    setGen("idle");
    setGenTitle(null);
    setGenMessage("");
    setSources(LOCAL_SOURCES);
    setScenarioVisual(null);
  }

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (!theme.trim() || gen === "loading") return;

    setGen("loading");
    setGenMessage("回答・根拠・因果モデル・写実画像を生成しています…");
    setGenTitle(null);

    try {
      const response = await fetch("/api/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: theme.trim(),
          audience: audience.trim(),
          learningGoal: learningGoal.trim(),
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          apiErrorMessage(body) ?? "シナリオを生成できませんでした。",
        );
      }

      const generated = generatedPayloadFrom(body);
      if (!generated) {
        throw new Error("生成結果の形式を確認できませんでした。");
      }

      setScenario(generated.scenario);
      setState(createInitialSimulationState(generated.scenario));
      setSources(generated.sources);
      setScenarioVisual(generated.visual);
      setGenTitle(generated.scenario.title);
      setGen("success");
      setGenMessage(
        generated.visual
          ? "GPT-5.6の回答と根拠、構造化モデル、通常／結果の写実画像を読み込みました。"
          : "回答と根拠、構造化モデルを読み込みました。画像生成は完了しなかったため、因果マップで表示します。",
      );
    } catch (error) {
      setGen("error");
      setGenMessage(
        error instanceof Error
          ? error.message
          : "生成サービスに接続できませんでした。ローカル火山デモはそのまま利用できます。",
      );
    }
  }

  const missionLabel = {
    active: "観測中",
    success: "達成",
    failure: "再挑戦",
  }[result.mission.status];
  const confidenceLabel = {
    low: "低",
    medium: "中",
    high: "高",
  }[scenario.learning.confidence.level];

  return (
    <main className="lab" style={style} id="top">
      <header>
        <a className="brand" href="#top">
          <b>C</b>
          <span>
            <strong>WhyMorph</strong>
            <small>CAUSE &amp; EFFECT LAB / 01</small>
          </span>
        </a>
        <nav aria-label="ページ内ナビ">
          <a href="#experiment">火山</a>
          <a href="#spider-experiment">クモ糸×飛行機</a>
          <a href="#evidence">回答と根拠</a>
          <a href="#learn">しくみ</a>
        </nav>
        <a className="gpt-link" href="#scenario">
          GPTでテーマ生成
        </a>
      </header>

      <section className="hero">
        <p className="kicker">
          <i>GPT-5.6 + LIVE MODEL</i> 因果シミュレーション・ラボ
        </p>
        <h1>
          「なぜ？」を、
          <br />
          <em>操作できる学びへ。</em>
        </h1>
        <p className="lead">
          GPT-5.6が自由な学習テーマを構造化し、複数の条件と結果を操作できる実験へ変換します。
          火山の変化と、クモの糸で飛行機を引く力の実験から体験できます。
        </p>
        <div className="meta">
          <span>MODEL　{scenario.title}</span>
          <span>CONTEXT　{scenario.location}</span>
          <span>
            ● {gen === "success" ? "GPT-5.6 GENERATED" : "LOCAL VOLCANO DEMO"}
          </span>
        </div>
      </section>

      <section className="experience-picker" aria-labelledby="experience-title">
        <div>
          <p className="kicker">CHOOSE AN EXPERIENCE</p>
          <h2 id="experience-title">どの「なぜ？」から試す？</h2>
        </div>
        <a href="#experiment">
          <span>EXPERIENCE / 01</span>
          <strong>火山はなぜ噴火する？</strong>
          <small>3つの原因から圧力と噴火を観察</small>
        </a>
        <a href="#spider-experiment">
          <span>EXPERIENCE / 02</span>
          <strong>クモの糸で飛行機は動く？</strong>
          <small>5つの条件から移動と切断を観察</small>
        </a>
      </section>

      <section className="experiment" id="experiment">
        <div className="controls">
          <div className="head">
            <div>
              <p className="kicker">INPUT VARIABLES</p>
              <h2>原因を操作する</h2>
            </div>
            <div className="head-actions">
              <button onClick={restoreCurrentScenario}>↻ 初期値</button>
              {!isVolcano && (
                <button onClick={restoreLocalDemo}>火山デモへ戻る</button>
              )}
            </div>
          </div>

          <div className="sliders">
            {KEYS.map((key, index) => {
              const control = scenario.variables[key];
              const value = values[key];
              const sliderStyle = {
                "--fill":
                  String(
                    ((value - control.min) /
                      (control.max - control.min || 1)) *
                      100,
                  ) + "%",
                "--accent": control.accent,
              } as CSSProperties;

              return (
                <div className="slider" key={key} style={sliderStyle}>
                  <div>
                    <span>0{index + 1}</span>
                    <label htmlFor={key}>
                      <strong>{control.label}</strong>
                      <small>{control.shortLabel}</small>
                    </label>
                    <output>
                      {Math.round(value)}
                      <i>{control.unit}</i>
                    </output>
                  </div>
                  <input
                    id={key}
                    type="range"
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    value={value}
                    onChange={(event) => update(key, Number(event.target.value))}
                    aria-describedby={key + "-description"}
                    aria-valuetext={String(value) + control.unit}
                  />
                  <p id={key + "-description"}>{control.description}</p>
                </div>
              );
            })}
          </div>

          <aside
            className={"mission " + result.mission.status}
            id="mission"
          >
            <div>
              <span>MISSION / 01</span>
              <b>{missionLabel}</b>
            </div>
            <h3>{result.mission.title}</h3>
            <p>{result.mission.objective}</p>
            <strong role="status">
              {result.mission.statusTitle} — {result.mission.message}
            </strong>
          </aside>
        </div>

        <div className={"visual " + (result.eruption ? "erupting" : "")}>
          <div className="head">
            <div>
              <p className="kicker">
                {isVolcano ? "SECTION VIEW / LIVE" : "CAUSE MAP / LIVE"}
              </p>
              <h2>{scenario.title}</h2>
            </div>
            <span className="live">● SIMULATION ACTIVE</span>
          </div>

          <div className="stage">
            {isVolcano ? (
              <div
                className="og-volcano-visual"
                role="img"
                aria-label="火山内部の断面図。数値に応じてマグマ、煙、閉塞、噴火状態が変化します"
              >
                <span className="og-magma-dimmer" aria-hidden="true" />
                <span className="og-magma-glow" aria-hidden="true" />
                <span className="og-conduit-glow" aria-hidden="true" />
                <span className="og-volcano-blockage" aria-hidden="true" />
                <span className="og-volcano-smoke" aria-hidden="true" />
                <span className="og-eruption-embers" aria-hidden="true" />
                <span
                  className="og-volcano-label og-volcano-label-magma"
                  aria-hidden="true"
                >
                  <b>MAGMA CHAMBER</b>
                  <small>マグマだまり</small>
                </span>
                <span
                  className="og-volcano-label og-volcano-label-conduit"
                  aria-hidden="true"
                >
                  <b>CONDUIT</b>
                  <small>火道</small>
                </span>
              </div>
            ) : scenarioVisual ? (
              <div
                className="generated-scene"
                style={
                  {
                    "--scenario-image": `url(${scenarioVisual.dataUrl})`,
                  } as CSSProperties
                }
                role="img"
                aria-label={scenarioVisual.alt}
              >
                <span className="generated-state">
                  {result.eruption ? "RESULT / 結果状態" : "BEFORE / 通常状態"}
                </span>
                <div className="generated-values" aria-label="現在の入力値">
                  {KEYS.map((key) => (
                    <span key={key}>
                      <small>{scenario.variables[key].shortLabel}</small>
                      <strong>{Math.round(values[key])}</strong>
                      <i>{scenario.variables[key].unit}</i>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="causal-map">
                <p>GPT-5.6 STRUCTURED SIMULATION</p>
                <div className="cause-row">
                  {KEYS.map((key) => (
                    <article
                      key={key}
                      style={
                        {
                          "--cause": scenario.variables[key].accent,
                        } as CSSProperties
                      }
                    >
                      <span>{scenario.variables[key].shortLabel}</span>
                      <strong>{Math.round(values[key])}</strong>
                      <small>{scenario.variables[key].unit}</small>
                    </article>
                  ))}
                </div>
                <div className="flow" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="effect-card">
                  <span>{scenario.derived.pressure.label}</span>
                  <strong>{derivedDisplay}</strong>
                  <small>{result.alert.headline}</small>
                </div>
              </div>
            )}

            <div
              className="gauge"
              aria-label={
                scenario.derived.pressure.label +
                " " +
                derivedDisplay +
                scenario.derived.pressure.unit
              }
            >
              <div>
                <span>
                  <strong>{derivedDisplay}</strong>
                  <i>{scenario.derived.pressure.unit}</i>
                </span>
              </div>
              <p>DERIVED INDEX</p>
              <small>{scenario.derived.pressure.label}</small>
            </div>

            {result.eruption && (
              <div className="eruption-alert" role="alert">
                <span>THRESHOLD EVENT</span>
                <strong>{result.eruptionTitle}</strong>
                <p>{result.eruptionMessage}</p>
              </div>
            )}
          </div>

          <div className="alert-strip" aria-live="polite">
            <div>
              <span>ALERT LEVEL</span>
              <strong>{result.alert.level}</strong>
            </div>
            <div>
              <p>{result.alert.label}</p>
              <h3>{result.alert.headline}</h3>
              <span>{result.alert.description}</span>
            </div>
            <div className="bars" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((level) => (
                <i
                  key={level}
                  className={level <= result.alert.level ? "on" : ""}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="evidence" id="evidence">
        <div className="evidence-heading">
          <p className="kicker">ANSWER / EVIDENCE / ASSUMPTIONS</p>
          <h2>{scenario.learning.question}</h2>
          <p>{scenario.learning.answer}</p>
        </div>
        <div className="evidence-grid">
          <article className="basis-card">
            <span>NUMERIC MODEL</span>
            <h3>数値化の考え方</h3>
            <p>{scenario.learning.modelBasis}</p>
            <div className="model-now" aria-live="polite">
              <span>現在の再計算結果</span>
              <strong>
                {derivedDisplay}
                <i>{scenario.derived.pressure.unit}</i>
              </strong>
              <small>
                警戒レベル {result.alert.level} / 閾値イベント：
                {result.eruption ? "成立" : "未成立"}
              </small>
            </div>
            <div
              className={
                "confidence " + scenario.learning.confidence.level
              }
            >
              <strong>モデル信頼度（GPT自己評価）：{confidenceLabel}</strong>
              <p>{scenario.learning.confidence.rationale}</p>
            </div>
          </article>
          <article className="assumption-card">
            <span>ASSUMPTIONS / LIMITS</span>
            <h3>このモデルの仮定</h3>
            <ul>
              {scenario.learning.assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          </article>
          <article className="source-card">
            <span>SOURCES</span>
            <h3>参考資料</h3>
            {sources.length > 0 ? (
              <ol>
                {sources.map((source, index) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {index + 1}. {source.title} ↗
                    </a>
                  </li>
                ))}
              </ol>
            ) : (
              <p>
                表示できる参考資料を取得できませんでした。信頼度を低として扱ってください。
              </p>
            )}
            <small>
              資料は現象の理解に使用し、係数と閾値は教育用の仮定として分けて表示しています。
            </small>
          </article>
        </div>
      </section>

      <SpiderPlaneLab />

      <section className="learn" id="learn">
        <div>
          <p className="kicker">HOW IT WORKS</p>
          <h2>
            入力から結果まで、
            <br />
            安全なルールでつなぐ。
          </h2>
          <p>
            GPT-5.6はコードではなく構造化JSONを生成します。実行時は許可済み演算子だけを評価し、
            AIが作ったJavaScriptを直接実行しません。
          </p>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <h3>テーマを構造化</h3>
              <p>学習目標、変数、範囲、因果ルール、ミッションへ分解します。</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>変数を操作</h3>
              <p>複数の値をひとつずつ変え、原因と結果の関係を観察します。</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>結果を説明</h3>
              <p>派生指標、警戒状態、成功・失敗条件を同じエンジンで評価します。</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="scenario" id="scenario">
        <div>
          <p className="kicker">GPT-5.6 SCENARIO GENERATOR</p>
          <h2>
            次の「なぜ？」を
            <br />
            実験に変える。
          </h2>
          <p className="scenario-copy">
            GPT-5.6が回答と根拠を調べ、変数・ルール・ミッションへ変換します。GPT Image 2は通常状態と結果状態の写実画像を作り、閾値に合わせて切り替えます。
          </p>
        </div>
        <form onSubmit={generate} aria-busy={gen === "loading"}>
          <div className="field">
            <label htmlFor="theme">学習テーマ</label>
            <input
              id="theme"
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
              placeholder="例：飛行機はなぜ飛ぶの？"
              maxLength={100}
              required
            />
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="audience">対象</label>
              <input
                id="audience"
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                maxLength={80}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="learning-goal">学びたいこと</label>
              <input
                id="learning-goal"
                value={learningGoal}
                onChange={(event) => setLearningGoal(event.target.value)}
                maxLength={200}
                required
              />
            </div>
          </div>
          <button
            className="generate-button"
            disabled={
              gen === "loading" ||
              !theme.trim() ||
              !audience.trim() ||
              learningGoal.trim().length < 5
            }
          >
            {gen === "loading"
              ? "GPT-5.6で生成中…"
              : "因果シミュレーションを生成 →"}
          </button>
          <small>
            APIキーはサーバー側だけで使用します。失敗時にAI生成を偽装せず、ローカル火山デモを維持します。
          </small>
          {genMessage && (
            <p className={"gen " + gen} role="status">
              {genTitle && <b>生成完了「{genTitle}」</b>}
              <span>{genMessage}</span>
            </p>
          )}
        </form>
      </section>

      <footer>
        <span>WhyMorph / CAUSE &amp; EFFECT LAB</span>
        <p>
          教育・体験用の簡略シミュレーション。専門的な予測、工学設計、安全判断には使用できません。
        </p>
        <a href="#top">TOP ↑</a>
      </footer>
    </main>
  );
}
