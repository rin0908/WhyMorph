"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import {
  SPIDER_PLANE_DISCLAIMER,
  SPIDER_PLANE_SCENARIO,
  SPIDER_PLANE_SOURCES,
  SPIDER_PLANE_VARIABLE_KEYS,
  SpiderPlaneValidationError,
  createSpiderPlaneState,
  evaluateSpiderPlane,
  setSpiderPlaneVariable,
  type SpiderPlaneVariableKey,
  type SpiderPlaneVariables,
} from "./data/spider-plane";

const integerFormatter = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 3,
});

const AIRCRAFT_MASK_PATH = `
  M 182 276 L 202 354 L 194 356 L 195 370 L 189 372 L 178 372
  L 178 376 L 172 378 L 172 391 L 187 398 L 230 413 L 246 413
  L 248 418 L 254 424 L 257 424 L 264 429 L 268 429 L 279 439
  L 291 439 L 296 437 L 304 437 L 305 435 L 316 438 L 332 437
  L 333 440 L 340 445 L 345 444 L 368 451 L 416 459 L 454 463
  L 560 464 L 570 471 L 573 471 L 576 475 L 582 477 L 582 495
  L 579 497 L 538 498 L 613 499 L 612 501 L 606 501 L 599 504
  L 563 506 L 563 509 L 591 509 L 689 503 L 755 503 L 764 502
  L 762 501 L 763 500 L 862 499 L 863 497 L 1024 497 L 1025 488
  L 1045 488 L 1047 486 L 1047 481 L 1049 483 L 1054 482
  L 1053 476 L 1057 474 L 1057 466 L 1059 463 L 1073 462
  L 1095 457 L 1100 457 L 1102 459 L 1141 444 L 1159 433
  L 1169 432 L 1163 432 L 1160 423 L 1145 410 L 1125 402
  L 1108 402 L 1106 400 L 1107 396 L 1105 393 L 1112 391
  L 1105 386 L 1087 378 L 1053 369 L 983 362 L 964 362
  L 963 360 L 708 360 L 705 357 L 700 357 L 699 360 L 580 360
  L 573 363 L 548 364 L 535 363 L 530 358 L 526 358 L 521 361
  L 461 361 L 457 357 L 454 357 L 453 360 L 425 360 L 424 362
  L 416 355 L 413 355 L 416 359 L 415 361 L 413 359 L 331 358
  L 330 347 L 312 329 L 308 322 L 299 313 L 296 308 L 296 303
  L 255 256 L 210 201 L 199 212 L 186 253 L 186 274 Z
`;

const AIRCRAFT_MASK_EXCLUSION_PATH = `
  M 800 510 C 826 505 846 495 858 478 L 874 462
  C 916 456 970 454 1024 458
  L 1024 510 L 800 510 Z
`;

function formatInteger(value: number | null) {
  return value === null ? "∞" : integerFormatter.format(value);
}

function formatForce(value: number) {
  if (value === 0) return "0 N";
  if (Math.abs(value) < 0.1) return `${value.toFixed(5)} N`;
  if (Math.abs(value) < 100) return `${value.toFixed(3)} N`;
  return `${decimalFormatter.format(value)} N`;
}

function formatScientific(value: number, digits = 6) {
  return value.toExponential(digits);
}

function displayVariableValue(key: SpiderPlaneVariableKey, value: number) {
  switch (key) {
    case "massKg":
    case "threadCount":
    case "tensileStrengthMegapascals":
      return integerFormatter.format(value);
    case "rollingResistanceCoefficient":
    case "targetAccelerationMetersPerSecondSquared":
      return value.toFixed(3);
    case "slopeAngleDegrees":
    case "attachmentEfficiency":
      return value.toFixed(2);
    case "threadDiameterMicrometers":
    case "safetyFactor":
      return value.toFixed(1);
  }
}

function calculateRangePresentation(
  key: SpiderPlaneVariableKey,
  value: number,
) {
  const definition = SPIDER_PLANE_SCENARIO.variables[key];
  return {
    min: definition.min,
    max: definition.max,
    step: definition.step,
    value,
    fill:
      ((value - definition.min) /
        (definition.max - definition.min || 1)) *
      100,
    fromSlider: (next: number) => next,
  };
}

export function SpiderPlaneLab() {
  const [variables, setVariables] = useState<SpiderPlaneVariables>(() =>
    createSpiderPlaneState(),
  );
  const [inputError, setInputError] = useState<string | null>(null);
  const result = useMemo(() => evaluateSpiderPlane(variables), [variables]);
  const style = {
    "--spider-status": result.color,
  } as CSSProperties;

  const threadPresets = useMemo(() => {
    const candidates: { label: string; value: number }[] = [
      { label: "糸1本", value: 1 },
      { label: "糸2本", value: 2 },
    ];
    if (result.breakingThreadCount !== null) {
      candidates.push({
        label: "破断回避の最少",
        value: result.breakingThreadCount,
      });
    }
    if (result.requiredThreadCount !== null) {
      candidates.push({
        label: "必要本数−1",
        value: Math.max(1, result.requiredThreadCount - 1),
      });
      candidates.push({
        label: "必要本数",
        value: result.requiredThreadCount,
      });
    }
    return candidates.filter(
      (candidate, index, array) =>
        candidate.value <= SPIDER_PLANE_SCENARIO.variables.threadCount.max &&
        array.findIndex((item) => item.value === candidate.value) === index,
    );
  }, [result.breakingThreadCount, result.requiredThreadCount]);

  function update(key: SpiderPlaneVariableKey, value: number) {
    try {
      const next = setSpiderPlaneVariable(variables, key, value);
      setVariables(next);
      setInputError(null);
    } catch (error) {
      setInputError(
        error instanceof SpiderPlaneValidationError
          ? error.message
          : "入力を更新できませんでした。範囲内の数値を確認してください。",
      );
    }
  }

  return (
    <>
      <section className="spider-lab" id="spider-experiment" style={style}>
        <div className="spider-intro">
          <p className="kicker">
            <i>EXPERIENCE / 02</i> SCIENCE-AUDITED TOWING MODEL
          </p>
          <h2>
            小さなクモの糸で、
            <br />
            実物の飛行機を動かせるか？
          </h2>
          <p>
            対象は模型ではなく、実物のBoeing 737-8です。質量、路面、傾斜、加速度と、
            クモ糸の断面積・材料強度・安全率をSI単位で計算します。
          </p>
          <div className="spider-subject" aria-label="計算対象">
            <span>CALCULATION SUBJECT</span>
            <strong>{SPIDER_PLANE_SCENARIO.subject}</strong>
            <b>{SPIDER_PLANE_SCENARIO.massBasis}</b>
            <small>
              写真は同型機の代表視覚です。写真撮影時の質量を示すものではありません。
            </small>
          </div>
        </div>

        <div className="spider-workbench">
          <aside className="spider-controls" aria-label="飛行機牽引モデルの入力条件">
            <div className="head">
              <div>
                <p className="kicker">9 INPUTS / SI UNITS</p>
                <h2>仮定を変える</h2>
              </div>
              <button
                className="spider-reset"
                type="button"
                onClick={() => {
                  setVariables(createSpiderPlaneState());
                  setInputError(null);
                }}
              >
                ↻ リセット
              </button>
            </div>

            <div className="spider-presets" aria-label="糸の本数を比較する">
              <span>本数を正確に比較</span>
              <div>
                {threadPresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    title={`${formatInteger(preset.value)}本`}
                    onClick={() => update("threadCount", preset.value)}
                  >
                    {preset.label}
                    <small>{formatInteger(preset.value)}本</small>
                  </button>
                ))}
              </div>
            </div>

            {inputError ? (
              <p className="spider-input-error" role="alert">
                {inputError}
              </p>
            ) : null}

            <div className="spider-sliders">
              {SPIDER_PLANE_VARIABLE_KEYS.map((key, index) => {
                const definition = SPIDER_PLANE_SCENARIO.variables[key];
                const value = variables[key];
                const range = calculateRangePresentation(key, value);
                const sliderStyle = {
                  "--fill": `${range.fill}%`,
                  "--accent": definition.accent,
                } as CSSProperties;

                return (
                  <div className="spider-slider" key={key} style={sliderStyle}>
                    <div className="spider-slider-head">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <label htmlFor={`spider-${key}`}>
                        <strong>{definition.label}</strong>
                        <small>{definition.shortLabel}</small>
                      </label>
                      <output htmlFor={`spider-${key}`}>
                        {displayVariableValue(key, value)}
                        {definition.unit ? <i>{definition.unit}</i> : null}
                      </output>
                    </div>
                    <div className="spider-input-pair">
                      <input
                        id={`spider-${key}`}
                        type="range"
                        min={range.min}
                        max={range.max}
                        step={range.step}
                        value={range.value}
                        onChange={(event) =>
                          update(
                            key,
                            range.fromSlider(Number(event.currentTarget.value)),
                          )
                        }
                        aria-describedby={`spider-${key}-description`}
                        aria-valuetext={`${displayVariableValue(key, value)}${definition.unit}`}
                      />
                      <input
                        className="spider-number-input"
                        type="number"
                        min={definition.min}
                        max={definition.max}
                        step={definition.step}
                        value={value}
                        aria-label={`${definition.label}の数値入力`}
                        onChange={(event) =>
                          update(key, Number(event.currentTarget.value))
                        }
                      />
                    </div>
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
                <p className="kicker">GROUND TOW / LIVE CALCULATION</p>
                <h2>糸と機体を観察する</h2>
              </div>
              <span className="live">● LOCAL MODEL ACTIVE</span>
            </div>

            <div
              className={`spider-stage spider-${result.status}`}
              data-state={result.status}
              data-plane-moves={String(result.planeMoves)}
              data-thread-breaks={String(result.threadBreaks)}
              aria-label={`現在の状態：${result.headline}。${result.stateLabel}。${result.explanation}`}
            >
              <div
                className="spider-state"
                id="spider-mission"
                role={result.threadBreaks ? "alert" : "status"}
                aria-live={result.threadBreaks ? "assertive" : "polite"}
                aria-atomic="true"
              >
                <span>{result.stateLabel}</span>
                <strong>{result.headline}</strong>
                <p>{result.explanation}</p>
                <span className="spider-sr-result">
                  必要牽引力は{formatForce(result.requiredForce)}。糸1本の安全使用力は
                  {formatForce(result.safeForcePerThread)}。必要な糸の本数は
                  {formatInteger(result.requiredThreadCount)}本。現在の本数は
                  {formatInteger(variables.threadCount)}本です。
                </span>
              </div>

              <div className="spider-camera">
                <div className="spider-runway-backdrop" aria-hidden="true" />
                <svg
                  className="spider-aircraft-layer"
                  viewBox="0 0 1245 702"
                  preserveAspectRatio="none"
                  data-plane="true"
                  role="img"
                  aria-label="SVGマスクで機体領域を分離した実写のBoeing 737-8。条件成立時は機体領域のレイヤーだけが移動します"
                >
                  <defs>
                    <clipPath
                      id="spider-aircraft-silhouette"
                      clipPathUnits="userSpaceOnUse"
                    >
                      <path
                        d={`${AIRCRAFT_MASK_PATH} ${AIRCRAFT_MASK_EXCLUSION_PATH}`}
                        clipRule="evenodd"
                      />
                      <path d="M 1054 458 L 1062 458 L 1062 500 L 1054 500 Z" />
                      <ellipse cx="1058" cy="500" rx="12" ry="11" />
                    </clipPath>
                  </defs>
                  <image
                    href="/boeing-737-taxi-cc-by-sa-4.jpg"
                    width="1245"
                    height="702"
                    preserveAspectRatio="none"
                    clipPath="url(#spider-aircraft-silhouette)"
                  />
                </svg>
                <div
                  className={`spider-thread-rig ${
                    result.failureMode === "attachment_failed"
                      ? "is-detached"
                      : result.threadBreaks
                        ? "is-broken"
                        : "is-intact"
                  }`}
                  aria-hidden="true"
                >
                  {result.threadBreaks ? (
                    <>
                      <div className="spider-thread-half spider-thread-half-left">
                        {[0, 1, 2, 3, 4].map((line) => (
                          <i key={line} />
                        ))}
                      </div>
                      <div className="spider-thread-half spider-thread-half-right">
                        {[0, 1, 2, 3, 4].map((line) => (
                          <i key={line} />
                        ))}
                      </div>
                      <b>破断</b>
                    </>
                  ) : (
                    <>
                      <div className="spider-thread-bundle">
                        {[0, 1, 2, 3, 4].map((line) => (
                          <i key={line} />
                        ))}
                      </div>
                      {result.failureMode === "attachment_failed" && (
                        <b>固定不能</b>
                      )}
                    </>
                  )}
                </div>
                <div className="spider-winch" aria-hidden="true">
                  <i />
                  <span>牽引点</span>
                </div>
                <div className="spider-thread-count">
                  <span>束で表示</span>
                  <strong>実数 {formatInteger(variables.threadCount)}本</strong>
                </div>
              </div>

              <div className="spider-visual-notes">
                <p>糸は視認性のため実際より太く描画。多数は5本の線で束として表現しています。</p>
                <p>実写写真の機体領域をSVGマスクで分離して移動。表示距離・時間は模式表現です。</p>
              </div>
            </div>

            <div className="spider-photo-credit">
              <span>PHOTO</span>
              <p>
                “Singapore Airlines Boeing 737 9V-MBA Singapore 2025 (02)” —
                Bahnfrend / Wikimedia Commons。背景をSVGマスクで除いた派生表示です。
              </p>
              <a
                href="https://commons.wikimedia.org/wiki/File:Singapore_Airlines_Boeing_737_9V-MBA_Singapore_2025_(02).jpg"
                target="_blank"
                rel="noreferrer"
              >
                元画像・作者
              </a>
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noreferrer"
              >
                CC BY-SA 4.0
              </a>
            </div>

            <div className="spider-metrics" aria-label="現在の計算結果">
              <article>
                <span>必要牽引力</span>
                <strong>{formatForce(result.requiredForce)}</strong>
                <small>転がり抵抗＋傾斜力＋加速力</small>
              </article>
              <article>
                <span>糸1本の安全使用力</span>
                <strong>{formatForce(result.safeForcePerThread)}</strong>
                <small>破断力×固定効率÷安全率</small>
              </article>
              <article>
                <span>必要な糸の本数</span>
                <strong>{formatInteger(result.requiredThreadCount)}本</strong>
                <small>安全使用力から切り上げ</small>
              </article>
              <article>
                <span>現在の本数で動くか</span>
                <strong>{result.planeMoves ? "はい" : "いいえ"}</strong>
                <small>安全条件成立時だけ「はい」</small>
              </article>
              <article>
                <span>糸が先に切れるか</span>
                <strong>{result.threadBreaks ? "はい" : "いいえ"}</strong>
                <small>必要力と有効破断力を比較</small>
              </article>
            </div>

            <div className="spider-dominant">
              <span>必要牽引力への最大寄与</span>
              <strong>{result.dominantCondition}</strong>
              <p>{result.dominantExplanation}</p>
            </div>

            <details className="spider-calculations" id="spider-calculations">
              <summary>計算を見る</summary>
              <div className="spider-calculation-body">
                <p>
                  すべてSI単位へ変換し、表示の丸め前の数値で計算しています。
                </p>
                <div className="spider-equations">
                  <article>
                    <span>1 / 転がり抵抗</span>
                    <code>rollingResistance = Crr × mass × gravity</code>
                    <p>
                      {variables.rollingResistanceCoefficient} × {variables.massKg} kg × {SPIDER_PLANE_SCENARIO.gravityMetersPerSecondSquared} m/s²
                    </p>
                    <strong>= {formatForce(result.rollingResistance)}</strong>
                  </article>
                  <article>
                    <span>2 / 傾斜力</span>
                    <code>slopeForce = mass × gravity × sin(angle)</code>
                    <p>
                      {variables.slopeAngleDegrees}° = {formatScientific(result.slopeAngleRadians, 4)} rad
                    </p>
                    <strong>= {formatForce(result.slopeForce)}</strong>
                  </article>
                  <article>
                    <span>3 / 加速力</span>
                    <code>accelerationForce = mass × targetAcceleration</code>
                    <p>
                      {variables.massKg} kg × {variables.targetAccelerationMetersPerSecondSquared} m/s²
                    </p>
                    <strong>= {formatForce(result.accelerationForce)}</strong>
                  </article>
                  <article>
                    <span>4 / 必要牽引力</span>
                    <code>requiredForce = rolling + slope + acceleration</code>
                    <p>
                      {result.rollingResistance.toFixed(3)} + {result.slopeForce.toFixed(3)} + {result.accelerationForce.toFixed(3)} N
                    </p>
                    <strong>= {formatForce(result.requiredForce)}</strong>
                  </article>
                  <article>
                    <span>5 / 糸の断面積</span>
                    <code>threadArea = PI × (diameter / 2)²</code>
                    <p>
                      {variables.threadDiameterMicrometers} µm = {formatScientific(result.threadDiameterMeters, 3)} m
                    </p>
                    <strong>= {formatScientific(result.threadArea)} m²</strong>
                  </article>
                  <article>
                    <span>6 / 糸1本の破断力</span>
                    <code>breakingForce = tensileStrength × threadArea</code>
                    <p>
                      {variables.tensileStrengthMegapascals} MPa = {formatScientific(result.tensileStrengthPascals, 3)} Pa
                    </p>
                    <strong>= {formatForce(result.singleThreadBreakingForce)}</strong>
                  </article>
                  <article>
                    <span>7 / 固定後の有効破断力</span>
                    <code>effectiveBreaking = breakingForce × attachmentEfficiency</code>
                    <p>
                      {result.singleThreadBreakingForce.toFixed(8)} N × {variables.attachmentEfficiency}
                    </p>
                    <strong>= {formatForce(result.effectiveBreakingForcePerThread)}</strong>
                  </article>
                  <article>
                    <span>8 / 糸1本の安全使用力</span>
                    <code>safeForce = effectiveBreaking / safetyFactor</code>
                    <p>
                      {result.effectiveBreakingForcePerThread.toFixed(8)} N ÷ {variables.safetyFactor}
                    </p>
                    <strong>= {formatForce(result.safeForcePerThread)}</strong>
                  </article>
                  <article>
                    <span>9 / 必要本数</span>
                    <code>requiredCount = ceil(requiredForce / safeForce)</code>
                    <p>
                      {result.requiredForce.toFixed(3)} N ÷ {result.safeForcePerThread.toFixed(8)} N/本
                    </p>
                    <strong>= {formatInteger(result.requiredThreadCount)}本</strong>
                  </article>
                  <article>
                    <span>10 / 現在の束</span>
                    <code>bundleCapacity = threadCount × forcePerThread</code>
                    <p>
                      有効破断力 {formatForce(result.bundleBreakingForce)} / 安全使用力 {formatForce(result.bundleSafeForce)}
                    </p>
                    <strong>
                      {result.failureMode === "attachment_failed"
                        ? "固定不能 → 機体は静止"
                        : result.threadBreaks
                          ? "必要力で破断 → 機体は静止"
                        : result.planeMoves
                          ? "安全条件成立 → 模式移動"
                          : "安全率不足 → 機体は静止"}
                    </strong>
                  </article>
                </div>
              </div>
            </details>
          </div>
        </div>
      </section>

      <section className="spider-learning" id="spider-evidence">
        <div className="spider-learning-heading">
          <p className="kicker">WHY DID IT HAPPEN?</p>
          <h2>必要な力と、糸の限界を分けて考える。</h2>
          <p>
            「破断しない」と「安全率を満たして動かせる」は別です。安全使用力から必要本数を求め、条件成立時だけ機体を動かします。
          </p>
        </div>
        <div className="spider-learning-grid">
          <article>
            <span>なぜ動かないの？</span>
            <strong>束の安全使用力 &lt; 必要牽引力</strong>
            <p>固定効率0、または必要本数未満なら、見栄えのために動かさず機体を静止させます。</p>
          </article>
          <article>
            <span>なぜ動いたの？</span>
            <strong>束の安全使用力 ≥ 必要牽引力</strong>
            <p>必要本数以上で、破断条件にも入らない場合だけ、模式的な移動を表示します。</p>
          </article>
          <article>
            <span>なぜ糸が切れたの？</span>
            <strong>必要牽引力 &gt; 束の有効破断力</strong>
            <p>必要張力までゆっくり力を増やす試行では、先に限界へ達した糸だけが切れ、飛行機は動きません。</p>
          </article>
        </div>

        <div className="spider-assumptions" id="spider-assumptions">
          <div>
            <p className="kicker">ASSUMPTIONS & LIMITS</p>
            <h3>仮定と制約</h3>
          </div>
          <ul>
            <li>牽引側が、目標加速度に必要な張力までゆっくり力を増やす試行を仮定します。破断力未満で止めれば、糸は切れず機体も動きません。</li>
            <li>低速・一次元、無風、水平に並べた糸へ荷重が均等に分かれると仮定。</li>
            <li>糸の断面は直径から求める真円と仮定し、材料強度が断面内で一様に働くものとします。</li>
            <li>エンジン停止、ブレーキ解除。牽引点強度、横風、衝撃、疲労、湿度、結び目の個別差は扱いません。</li>
            <li>転がり抵抗係数は乾燥路面の資料値を参照した仮定で、当該737-8の実測値ではありません。</li>
            <li>自然クモ糸を数百万本、均一に生産・整列・固定できるかは評価していません。</li>
            <li>傾斜時の転がり抵抗は指定式 Crr × m × g を用いる小角度近似です。</li>
            <li>必要本数以上なら破断しないのは、安全使用力が破断力より小さいというモデル上の不変条件です。</li>
          </ul>
        </div>

        <div className="spider-sources">
          <p className="kicker">SOURCES / ASSUMPTIONS</p>
          <div>
            {SPIDER_PLANE_SOURCES.map((source) => (
              <article key={source.title}>
                <span>{source.kind}</span>
                <strong>{source.title}</strong>
                <p>{source.use}</p>
                <a href={source.url}>確認する</a>
              </article>
            ))}
          </div>
        </div>

        <p className="spider-disclaimer">{SPIDER_PLANE_DISCLAIMER}</p>
      </section>
    </>
  );
}
