"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import {
  RAIN_LIGHTNING_DERIVED,
  RAIN_LIGHTNING_DISCLAIMERS,
  RAIN_LIGHTNING_INPUT_KEYS,
  RAIN_LIGHTNING_INPUTS,
  RAIN_LIGHTNING_THRESHOLDS,
  createRainLightningInputs,
  evaluateRainLightning,
  setRainLightningInput,
  type RainLightningInputKey,
  type RainLightningInputs,
} from "./data/rain-lightning";
import styles from "./RainLightningLab.module.css";

type WeatherStyle = CSSProperties & Record<`--wx-${string}`, string>;

const RAIN_DROP_IDS = Array.from({ length: 54 }, (_, index) => index);

function rainDropStyle(index: number, fast: boolean): WeatherStyle {
  const depth = (index * 7) % 5;
  const lane = (index * 41 + (index % 7) * 17) % 91;
  const length =
    (fast ? 18 : 12) + depth * (fast ? 4.8 : 3.2) + (index % 3) * 2;
  const duration = fast
    ? 0.48 + (4 - depth) * 0.065 + (index % 3) * 0.025
    : 0.88 + (4 - depth) * 0.105 + (index % 4) * 0.04;

  return {
    "--wx-drop-left": `${4.5 + lane}%`,
    "--wx-drop-delay": `${-((index * 17) % 37) / 10}s`,
    "--wx-drop-duration": `${duration.toFixed(3)}s`,
    "--wx-drop-length": `${length.toFixed(1)}px`,
    "--wx-drop-opacity": `${(0.22 + depth * 0.105).toFixed(3)}`,
    "--wx-drop-width": `${(0.65 + depth * 0.22).toFixed(2)}px`,
    "--wx-drop-blur": `${depth < 2 ? 0.45 - depth * 0.2 : 0}px`,
    "--wx-drop-angle": `${5 + (index % 4) * 0.8}deg`,
    "--wx-drop-drift": `${(fast ? 20 : 14) + (index % 5) * 2.5}px`,
  };
}

function formatRelative(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

export function RainLightningLab() {
  const [inputs, setInputs] = useState<RainLightningInputs>(() =>
    createRainLightningInputs(),
  );
  const result = useMemo(() => evaluateRainLightning(inputs), [inputs]);
  const cloudOpacity = result.flags.cloudVisible
    ? Math.min(0.98, 0.42 + result.derived.cloudDevelopment / 120)
    : 0;
  const cloudScaleX = Math.min(
    1.03,
    0.5 + result.derived.cloudDevelopment / 170,
  );
  const cloudScaleY = Math.min(
    1.22,
    0.52 +
      result.derived.cloudDevelopment / 170 +
      result.inputs.updraft / 700,
  );
  const overcastOpacity = Math.min(
    0.82,
    result.derived.cloudDevelopment / 125 +
      result.derived.precipitationIntensity / 300,
  );
  const sceneStyle: WeatherStyle = {
    "--wx-cloud-opacity": cloudOpacity.toFixed(3),
    "--wx-cloud-scale-x": cloudScaleX.toFixed(3),
    "--wx-cloud-scale-y": cloudScaleY.toFixed(3),
    "--wx-cloud-tower-opacity":
      result.state === "cloud_forming"
        ? "0.1"
        : result.flags.cloudVisible
          ? Math.min(
              1,
              0.08 +
                result.derived.cloudDevelopment / 60 +
                result.inputs.updraft / 180,
            ).toFixed(3)
          : "0",
    "--wx-overcast-opacity": overcastOpacity.toFixed(3),
    "--wx-sun-opacity": Math.max(
      0.04,
      0.92 -
        result.derived.cloudDevelopment / 95 -
        result.derived.precipitationIntensity / 210,
    ).toFixed(3),
    "--wx-storm-opacity": Math.min(
      0.5,
      (result.derived.precipitationIntensity +
        result.derived.chargeSeparation) /
        280,
    ).toFixed(3),
    "--wx-updraft-opacity": result.flags.cloudVisible
      ? Math.min(0.68, result.inputs.updraft / 130).toFixed(3)
      : "0",
    "--wx-anvil-opacity": result.flags.thundercloud ? "1" : "0",
    "--wx-potential": `${result.derived.lightningPotential}%`,
  };

  function update(key: RainLightningInputKey, value: number) {
    setInputs((current) => setRainLightningInput(current, key, value));
  }

  function reset() {
    setInputs(createRainLightningInputs());
  }

  const sceneDescription = `${result.stateLabel}。${result.explanation} 降水強度 ${formatRelative(
    result.derived.precipitationIntensity,
  )}、雷発生可能性 ${formatRelative(result.derived.lightningPotential)}。`;

  return (
    <section
      className={styles.wxRoot}
      id="rain-lightning-experiment"
      data-weather-state={result.state}
      data-raining={String(result.flags.raining)}
      data-lightning={String(result.flags.lightning)}
    >
      <div className={styles.wxIntro}>
        <div>
          <p className={styles.wxKicker}>EXPERIENCE / 02 · WEATHER LAB</p>
          <h2>雨はどう生まれ、なぜ雷が起こる？</h2>
        </div>
        <p>
          3つの条件を動かして、晴れから雲・雨・雷へ変わる因果関係を発見しよう。
          雨が強くても、雷の条件がそろうとは限りません。
        </p>
      </div>

      <div className={styles.wxWorkbench}>
        <aside className={styles.wxControls} aria-label="雨と雷の入力条件">
          <div className={styles.wxControlHeading}>
            <div>
              <span>CAUSES / 3 INPUTS</span>
              <h3>空の条件を操作する</h3>
            </div>
            <button type="button" onClick={reset} className={styles.wxReset}>
              ↻ 初期値
            </button>
          </div>

          <div className={styles.wxSliders}>
            {RAIN_LIGHTNING_INPUT_KEYS.map((key, index) => {
              const definition = RAIN_LIGHTNING_INPUTS[key];
              const value = inputs[key];
              const sliderStyle = {
                "--wx-input-accent": definition.accent,
                "--wx-input-fill": `${value}%`,
              } as WeatherStyle;

              return (
                <div className={styles.wxSlider} key={key} style={sliderStyle}>
                  <div className={styles.wxSliderHeading}>
                    <span>0{index + 1}</span>
                    <label htmlFor={`wx-${key}`}>
                      <strong>{definition.label}</strong>
                      <small>{definition.shortLabel}</small>
                    </label>
                    <div className={styles.wxValueEditor}>
                      <input
                        id={`wx-${key}-number`}
                        type="number"
                        min={definition.min}
                        max={definition.max}
                        step={definition.step}
                        value={value}
                        onChange={(event) =>
                          update(key, Number(event.target.value))
                        }
                        aria-label={`${definition.label} 数値入力`}
                      />
                      <span>/ 100</span>
                    </div>
                  </div>
                  <input
                    id={`wx-${key}`}
                    type="range"
                    min={definition.min}
                    max={definition.max}
                    step={definition.step}
                    value={value}
                    onChange={(event) => update(key, Number(event.target.value))}
                    aria-describedby={`wx-${key}-description`}
                    aria-valuetext={`${definition.label} ${value}、100段階の相対値`}
                  />
                  <p id={`wx-${key}-description`}>{definition.description}</p>
                </div>
              );
            })}
          </div>

          <div
            className={styles.wxStateCard}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-weather-label={result.stateLabel}
          >
            <div>
              <span>CURRENT STATE</span>
              <b>{result.flags.lightning ? "放電条件成立" : "観察中"}</b>
            </div>
            <strong>{result.stateLabel}</strong>
            <p>{result.explanation}</p>
            <small>{result.nextDiscovery}</small>
          </div>
        </aside>

        <div className={styles.wxVisual}>
          <div className={styles.wxVisualHeading}>
            <div>
              <span>SKY SECTION / LIVE</span>
              <h3>空・雲・雨・電荷の変化</h3>
            </div>
            <b>● SIMULATION ACTIVE</b>
          </div>

          <div
            className={styles.wxScene}
            style={sceneStyle}
            role="group"
            aria-label={sceneDescription}
          >
            <div className={styles.wxHorizon} aria-hidden="true" />
            <div className={styles.wxSun} aria-hidden="true" />
            <div className={styles.wxStormShade} aria-hidden="true" />

            <div className={styles.wxUpdrafts} aria-hidden="true">
              <i />
              <i />
              <i />
            </div>

            <div className={styles.wxCloudSystem} aria-hidden="true">
              <div className={styles.wxCloudAnvil}>
                <i />
                <i />
                <i />
              </div>
              <div className={styles.wxCloudTower}>
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className={styles.wxCloudBody}>
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className={styles.wxCloudBase} />
              <div className={styles.wxCloudShadow} />
            </div>

            {result.flags.thundercloud && (
              <div
                className={styles.wxCharges}
                data-charge-layer="visible"
                aria-hidden="true"
              >
                <span className={styles.wxPositive}>＋ 正電荷</span>
                <span className={styles.wxNegative}>− 負電荷</span>
                <small>電荷分離の簡略表示</small>
              </div>
            )}

            {result.flags.raining && (
              <div
                className={`${styles.wxRainField} ${
                  result.flags.heavyRain ? styles.wxRainHeavy : ""
                }`}
                data-rain-field={result.rainSpeed}
                aria-hidden="true"
              >
                {RAIN_DROP_IDS.slice(0, result.rainDropCount).map((index) => (
                  <i
                    className={styles.wxRainDrop}
                    style={rainDropStyle(index, result.flags.heavyRain)}
                    data-rain-drop="true"
                    key={index}
                  />
                ))}
              </div>
            )}

            {result.flags.lightning && (
              <div
                className={styles.wxLightning}
                data-lightning-bolt="visible"
                aria-hidden="true"
              >
                <i />
                <svg
                  className={styles.wxLightningSvg}
                  viewBox="0 0 140 300"
                  preserveAspectRatio="xMidYMin meet"
                  focusable="false"
                >
                  <path
                    className={styles.wxLightningMain}
                    d="M82 4 L70 50 L79 78 L59 121 L67 149 L45 195 L52 220 L29 290"
                  />
                  <path
                    className={styles.wxLightningBranch}
                    d="M61 117 L39 141 L23 174"
                  />
                  <path
                    className={styles.wxLightningBranch}
                    d="M47 193 L27 213 L13 247"
                  />
                  <path
                    className={styles.wxLightningBranch}
                    d="M65 147 L91 171 L107 205"
                  />
                </svg>
              </div>
            )}

            <div className={styles.wxSceneState}>
              <span>NOW</span>
              <strong>{result.stateLabel}</strong>
            </div>

            <div className={styles.wxPotentialCard}>
              <div>
                <span>電位差メーター（教育用代理指標）</span>
                <strong>
                  {formatRelative(result.derived.lightningPotential)}
                  <i> / 100</i>
                </strong>
              </div>
              <div
                className={styles.wxPotentialTrack}
                data-lightning-potential={result.derived.lightningPotential}
                role="meter"
                aria-label="雷の放電条件を表す教育用代理指標"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={result.derived.lightningPotential}
                aria-valuetext={`${formatRelative(
                  result.derived.lightningPotential,
                )}。放電条件は${
                  result.flags.lightning ? "成立" : "未成立"
                }です`}
              >
                <i />
                <b
                  title={`放電の目安 ${RAIN_LIGHTNING_THRESHOLDS.LIGHTNING_POTENTIAL_MIN}`}
                />
              </div>
              <small>
                相対指標・放電の目安 {RAIN_LIGHTNING_THRESHOLDS.LIGHTNING_POTENTIAL_MIN}
              </small>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.wxLearning}>
        <article className={styles.wxDerivedPanel}>
          <div className={styles.wxPanelHeading}>
            <span>CALCULATED / NOT DIRECTLY CONTROLLED</span>
            <h3>3つの入力から計算した変化</h3>
          </div>
          <div className={styles.wxDerivedGrid}>
            {RAIN_LIGHTNING_DERIVED.map((definition) => (
              <div key={definition.key}>
                <span>{definition.shortLabel}</span>
                <strong>{formatRelative(result.derived[definition.key])}</strong>
                <b>{definition.label}</b>
                <small>{definition.description}</small>
              </div>
            ))}
          </div>
        </article>

        <aside className={styles.wxMissingPanel}>
          <div className={styles.wxPanelHeading}>
            <span>NEXT CONDITIONS</span>
            <h3>いま不足している条件</h3>
          </div>
          {result.missingConditions.length > 0 ? (
            <ul>
              {result.missingConditions.map((item) => (
                <li key={item.label}>
                  <span>{item.label}</span>
                  <strong>
                    {formatRelative(item.current)}
                    <i> / 目安 {item.threshold}</i>
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.wxComplete}>
              放電までの条件がそろいました。1つずつ下げて、どの状態へ戻るか確かめよう。
            </p>
          )}
          <small>
            目安との差を、そのまま1つの入力に足すという意味ではありません。派生値は3条件の組み合わせで変わります。
          </small>
        </aside>
      </div>

      <details className={styles.wxMethod}>
        <summary>計算と判定の考え方を見る</summary>
        <div>
          <p>
            水蒸気 ×（上昇気流と不安定さ）で凝結を求め、凝結 → 雲の発達 →
            粒の成長 → 降水を順に計算します。雷は雨の次段階として固定せず、雲の発達・氷相・電荷分離・上昇気流・不安定さ・雷発生可能性を別々に確認します。
          </p>
          <ol>
            <li>水蒸気だけ、上昇気流だけでは雨にしません。</li>
            <li>雲・粒・降水の3条件がそろったときだけ雨粒を表示します。</li>
            <li>強い雨でも氷相と電荷分離が不足すれば稲妻を表示しません。</li>
            <li>同じ入力には必ず同じ結果を返し、乱数は使いません。</li>
          </ol>
        </div>
      </details>

      <div className={styles.wxDisclaimers}>
        {RAIN_LIGHTNING_DISCLAIMERS.map((disclaimer) => (
          <p key={disclaimer}>{disclaimer}</p>
        ))}
      </div>
    </section>
  );
}
