"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import {
  SPIDER_PLANE_SCENARIO,
  SPIDER_PLANE_VARIABLE_KEYS,
  createSpiderPlaneState,
  evaluateSpiderPlane,
  setSpiderPlaneVariable,
  type SpiderPlaneVariableKey,
  type SpiderPlaneVariables,
} from "./data/spider-plane";

const DEMO_PRESETS: readonly {
  label: string;
  values: SpiderPlaneVariables;
}[] = [
  {
    label: "1本で試す",
    values: { ...SPIDER_PLANE_SCENARIO.reset },
  },
  {
    label: "少し動く",
    values: {
      threadCount: 6,
      threadStrength: 12,
      pullForce: 7,
      planeMass: 200,
      friction: 2,
    },
  },
  {
    label: "動いた！",
    values: {
      threadCount: 20,
      threadStrength: 12,
      pullForce: 7,
      planeMass: 200,
      friction: 2,
    },
  },
  {
    label: "切れる",
    values: {
      threadCount: 20,
      threadStrength: 12,
      pullForce: 15,
      planeMass: 200,
      friction: 2,
    },
  },
] as const;

function formatNumber(value: number, digits = 1) {
  return value.toFixed(digits).replace(/\.0$/, "");
}

export function SpiderPlaneLab() {
  const [variables, setVariables] = useState<SpiderPlaneVariables>(() =>
    createSpiderPlaneState(),
  );
  const result = useMemo(
    () => evaluateSpiderPlane(variables),
    [variables],
  );
  const planeShift = result.movementPercent * 2.5;
  const threadScale = Math.max(0.48, 1 - planeShift / 390);
  const style = {
    "--spider-status": result.color,
    "--spider-plane-shift": `${planeShift}px`,
    "--spider-thread-scale": String(threadScale),
  } as CSSProperties;

  function update(key: SpiderPlaneVariableKey, value: number) {
    setVariables((current) =>
      setSpiderPlaneVariable(current, key, value),
    );
  }

  return (
    <>
      <section
        className="spider-lab"
        id="spider-experiment"
        style={style}
      >
        <div className="spider-intro">
          <p className="kicker">
            <i>EXPERIENCE / 02</i> SPIDER THREAD × AIRPLANE
          </p>
          <h2>
            小さなクモの糸で、
            <br />
            飛行機を動かせるか？
          </h2>
          <p>
            糸は1本では足りません。本数、強さ、引く力、質量、摩擦を変えて、
            「動く境目」と「切れる限界」を見つけてください。
          </p>
        </div>

        <div className="spider-workbench">
          <aside className="spider-controls" aria-label="飛行機実験の条件">
            <div className="head">
              <div>
                <p className="kicker">5 INPUT VARIABLES</p>
                <h2>条件を変える</h2>
              </div>
              <button
                className="spider-reset"
                type="button"
                onClick={() => setVariables(createSpiderPlaneState())}
              >
                ↻ リセット
              </button>
            </div>

            <div className="spider-presets" aria-label="すぐ試せる4つの状態">
              <span>すぐ試す</span>
              <div>
                {DEMO_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setVariables({ ...preset.values })}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="spider-sliders">
              {SPIDER_PLANE_VARIABLE_KEYS.map((key, index) => {
                const definition = SPIDER_PLANE_SCENARIO.variables[key];
                const value = variables[key];
                const sliderStyle = {
                  "--fill": `${
                    ((value - definition.min) /
                      (definition.max - definition.min || 1)) *
                    100
                  }%`,
                  "--accent": definition.accent,
                } as CSSProperties;

                return (
                  <div className="spider-slider" key={key} style={sliderStyle}>
                    <div>
                      <span>0{index + 1}</span>
                      <label htmlFor={`spider-${key}`}>
                        <strong>{definition.label}</strong>
                        <small>{definition.shortLabel}</small>
                      </label>
                      <output htmlFor={`spider-${key}`}>
                        {formatNumber(value, 0)}
                        <i>{definition.unit}</i>
                      </output>
                    </div>
                    <input
                      id={`spider-${key}`}
                      type="range"
                      min={definition.min}
                      max={definition.max}
                      step={definition.step}
                      value={value}
                      onChange={(event) =>
                        update(key, Number(event.currentTarget.value))
                      }
                      aria-describedby={`spider-${key}-description`}
                      aria-valuetext={`${value}${definition.unit}`}
                    />
                    <p id={`spider-${key}-description`}>
                      {definition.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </aside>

          <div className="spider-visual">
            <div className="head">
              <div>
                <p className="kicker">HANGAR TEST / LIVE</p>
                <h2>飛行機の動きを観察する</h2>
              </div>
              <span className="live">● SIMULATION ACTIVE</span>
            </div>

            <div
              className={`spider-stage spider-${result.status}`}
              data-state={result.status}
              aria-label={`現在の状態：${result.headline} ${result.explanation}`}
            >
              <div className="spider-state" id="spider-mission">
                <span>{result.eyebrow}</span>
                <strong
                  role={result.status === "snapped" ? "alert" : "status"}
                  aria-live={result.status === "snapped" ? "assertive" : "polite"}
                  aria-atomic="true"
                >
                  {result.headline}
                </strong>
                <p>{result.explanation}</p>
              </div>

              <div className="spider-break-flash" aria-hidden="true">
                <i />
              </div>

              <svg
                className="spider-scene"
                viewBox="0 0 960 390"
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="格納庫でクモの糸が飛行機を右へ引く実験"
              >
                <defs>
                  <linearGradient id="hangar-sky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#202a30" />
                    <stop offset="1" stopColor="#101619" />
                  </linearGradient>
                  <linearGradient id="plane-body" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#f6f8f3" />
                    <stop offset="0.52" stopColor="#aebbc0" />
                    <stop offset="1" stopColor="#536169" />
                  </linearGradient>
                  <linearGradient id="plane-wing" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#c6d1d3" />
                    <stop offset="1" stopColor="#526168" />
                  </linearGradient>
                  <radialGradient id="winch-glow">
                    <stop offset="0" stopColor="#65d6ce" stopOpacity=".42" />
                    <stop offset="1" stopColor="#65d6ce" stopOpacity="0" />
                  </radialGradient>
                  <filter id="plane-shadow" x="-30%" y="-30%" width="160%" height="180%">
                    <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#000" floodOpacity=".6" />
                  </filter>
                  <filter id="thread-glow" x="-30%" y="-50%" width="160%" height="200%">
                    <feGaussianBlur stdDeviation="1.4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <rect width="960" height="390" fill="url(#hangar-sky)" />
                <g className="spider-hangar" aria-hidden="true">
                  <path d="M35 262V60H925V262" />
                  <path d="M195 262V60M365 262V60M535 262V60M705 262V60M875 262V60" />
                  <path d="M35 105H925M35 153H925M35 201H925" />
                  <path d="M35 60 195 153 365 60 535 153 705 60 875 153 925 125" />
                </g>
                <rect y="278" width="960" height="112" fill="#0d1113" />
                <path className="spider-runway-edge" d="M0 279H960" />
                <path className="spider-runway-line" d="M26 355H934" />
                <path className="spider-runway-dash" d="M40 318H890" />

                <g className="spider-motion-lines" aria-hidden="true">
                  <path d="M55 184H202" />
                  <path d="M92 207H222" />
                  <path d="M36 232H190" />
                </g>

                {result.status !== "snapped" ? (
                  <g
                    className="spider-thread-intact"
                    aria-hidden="true"
                  >
                    <path d="M500 223H890" />
                    <path d="M500 228H890" />
                    <path d="M500 233H890" />
                  </g>
                ) : (
                  <g className="spider-thread-broken" aria-hidden="true">
                    <g className="spider-thread-left">
                      <path d="M500 223 666 231 686 252" />
                      <path d="M500 228 658 237 678 260" />
                      <path d="M500 233 650 243 670 268" />
                    </g>
                    <g className="spider-thread-right">
                      <path d="M715 252 735 231 890 223" />
                      <path d="M723 260 743 237 890 228" />
                      <path d="M731 268 751 243 890 233" />
                    </g>
                    <g className="spider-snap-spark">
                      <path d="m699 226-8 16 12-3 2 17 9-21-12 4z" />
                    </g>
                  </g>
                )}

                <g className="spider-plane-motion" data-plane="true">
                  <g transform="translate(180 0)" filter="url(#plane-shadow)">
                    <ellipse className="spider-plane-shadow" cx="168" cy="292" rx="143" ry="12" />
                    <path
                      className="spider-plane-tail-wing"
                      d="M38 225 2 157h39l55 72z"
                    />
                    <path
                      className="spider-plane-wing-back"
                      d="m151 236-53 91h48l93-87z"
                    />
                    <path
                      className="spider-plane-body"
                      d="M8 220c58-8 108-10 175-8 48 1 79 4 105 11 15 4 28 12 34 20-8 10-25 17-47 20-73 10-178 6-266-14-12-3-12-25-1-29z"
                    />
                    <path
                      className="spider-plane-nose"
                      d="M275 223c23 3 40 10 47 20-7 9-23 16-47 20 10-10 10-30 0-40z"
                    />
                    <path
                      className="spider-plane-wing-front"
                      d="m154 232 43-124h52l-20 128z"
                    />
                    <path
                      className="spider-plane-stripe"
                      d="M21 244c78 11 174 17 276 7"
                    />
                    <g className="spider-plane-windows">
                      {[92, 113, 134, 155, 176, 197, 218, 239].map((x) => (
                        <rect key={x} x={x} y="226" width="12" height="7" rx="3" />
                      ))}
                    </g>
                    <path className="spider-cockpit" d="m280 229 21 6-17 7z" />
                    <g className="spider-plane-wheels">
                      <path d="M96 255v17M240 257v15" />
                      <circle cx="96" cy="279" r="10" />
                      <circle cx="240" cy="279" r="10" />
                      <circle cx="96" cy="279" r="4" />
                      <circle cx="240" cy="279" r="4" />
                    </g>
                  </g>
                </g>

                <g className="spider-winch" aria-hidden="true">
                  <circle className="spider-winch-aura" cx="895" cy="228" r="58" />
                  <circle cx="895" cy="228" r="31" />
                  <circle cx="895" cy="228" r="15" />
                  <path d="M895 188v-18m0 76v18m40-36h18m-76 0h-18m65-28 13-13m-53 53-13 13m53 0 13 13m-53-53-13-13" />
                  <path d="M895 264v25h34" />
                  <text x="895" y="322" textAnchor="middle">PULL SIDE</text>
                </g>

                <g className="spider-thread-count" aria-hidden="true">
                  <rect x="740" y="174" width="112" height="30" rx="4" />
                  <text x="796" y="194" textAnchor="middle">
                    THREAD × {variables.threadCount}
                  </text>
                </g>
              </svg>
            </div>

            <div className="spider-metrics" aria-label="現在の計算結果">
              <article>
                <span>必要な糸の本数</span>
                <strong>
                  {variables.pullForce <= 0
                    ? "引く力 0"
                    : result.requiredThreadCount === null
                      ? "強さ不足"
                    : `${result.requiredThreadCount}本`}
                </strong>
                <small>いまの力で動き始める目安</small>
              </article>
              <article>
                <span>現在の合計強度</span>
                <strong>{formatNumber(result.totalStrength)}N</strong>
                <small>本数 × 1本あたりの強さ</small>
              </article>
              <article>
                <span>現在の合計引力</span>
                <strong>{formatNumber(result.totalPull)}N</strong>
                <small>本数 × 1本あたりの引く力</small>
              </article>
              <article>
                <span>地面の摩擦力</span>
                <strong>{formatNumber(result.frictionForce)}N</strong>
                <small>質量 × 重力 × 摩擦率</small>
              </article>
            </div>

            <div className="spider-dominant" aria-live="polite">
              <span>いちばん影響した条件</span>
              <strong>{result.dominantCondition}</strong>
              <p>{result.dominantExplanation}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="spider-learning" id="spider-evidence">
        <div className="spider-learning-heading">
          <p className="kicker">WHY DID IT HAPPEN?</p>
          <h2>力のつり合いと、糸の限界。</h2>
          <p>
            「動く条件」と「切れない条件」は別です。数字を1つずつ変えると、
            どの原因が結果を変えたか見つけられます。
          </p>
        </div>
        <div className="spider-learning-grid">
          <article>
            <span>なぜ動かないの？</span>
            <strong>合計引力 ≤ 摩擦力</strong>
            <p>地面が止める力のほうが大きいと、飛行機はその場に残ります。</p>
          </article>
          <article>
            <span>なぜ動いたの？</span>
            <strong>合計引力 &gt; 摩擦力</strong>
            <p>摩擦を超えた力が残ると動き、残った力が大きいほど遠くへ進みます。</p>
          </article>
          <article>
            <span>なぜ糸が切れたの？</span>
            <strong>1本の引力 &gt; 1本の強さ</strong>
            <p>1本にかかる力が耐久限界を超えると、束全体が途中で切れます。</p>
          </article>
        </div>
        <p className="spider-disclaimer">
          教育用に単純化した3秒間のモデルです。実際の航空機やクモ糸の厳密な工学計算、設計、安全判断には使用できません。
        </p>
      </section>
    </>
  );
}
