import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  RAIN_LIGHTNING_DEFAULTS,
  RAIN_LIGHTNING_DISCLAIMERS,
  RAIN_LIGHTNING_THRESHOLDS,
  createRainLightningInputs,
  evaluateRainLightning,
  normalizeRainLightningInputs,
  setRainLightningInput,
  type RainLightningInputs,
  type RainLightningStateId,
} from "../app/data/rain-lightning";

const stateWith = (
  changes: Partial<RainLightningInputs>,
): RainLightningInputs => ({
  ...createRainLightningInputs(),
  ...changes,
});

const representativeCases: readonly {
  readonly state: RainLightningStateId;
  readonly input: RainLightningInputs;
  readonly expectedDerived: readonly number[];
}[] = [
  {
    state: "sunny",
    input: { waterVapor: 20, instability: 20, updraft: 15 },
    expectedDerived: [3.4, 1.8, 0.3, 0, 0, 0, 0],
  },
  {
    state: "cloud_forming",
    input: { waterVapor: 50, instability: 30, updraft: 35 },
    expectedDerived: [16.6, 10.4, 4.3, 1.1, 0, 0, 0],
  },
  {
    state: "cloud_developing",
    input: { waterVapor: 70, instability: 50, updraft: 70 },
    expectedDerived: [44.1, 34.2, 22.6, 11.3, 5.3, 1, 0.3],
  },
  {
    state: "rain",
    input: { waterVapor: 90, instability: 60, updraft: 80 },
    expectedDerived: [65.7, 54.5, 44.2, 30.3, 16.2, 5.9, 2.4],
  },
  {
    state: "heavy_rain",
    input: { waterVapor: 100, instability: 60, updraft: 100 },
    expectedDerived: [86, 75.7, 69.6, 60.3, 32.4, 21.7, 11.9],
  },
  {
    state: "thundercloud",
    input: { waterVapor: 90, instability: 90, updraft: 90 },
    expectedDerived: [81, 76.5, 68.9, 56.9, 55.5, 38.1, 27.1],
  },
  {
    state: "lightning",
    input: { waterVapor: 95, instability: 95, updraft: 95 },
    expectedDerived: [90.3, 87.8, 83.4, 75.9, 75.2, 62.7, 52.8],
  },
] as const;

function derivedValues(input: RainLightningInputs) {
  const derived = evaluateRainLightning(input).derived;
  return [
    derived.condensationEase,
    derived.cloudDevelopment,
    derived.particleGrowth,
    derived.precipitationIntensity,
    derived.icePhaseDevelopment,
    derived.chargeSeparation,
    derived.lightningPotential,
  ];
}

test("初期値は晴れで、指定の教育用注意書きを保持する", () => {
  const initial = createRainLightningInputs();
  const result = evaluateRainLightning(initial);

  assert.deepEqual(initial, RAIN_LIGHTNING_DEFAULTS);
  assert.equal(result.state, "sunny");
  assert.equal(result.flags.raining, false);
  assert.equal(result.flags.lightning, false);
  assert.match(RAIN_LIGHTNING_DISCLAIMERS[0], /天気予報には使用できません/);
  assert.match(RAIN_LIGHTNING_DISCLAIMERS[1], /現在も研究されている/);
});

test("水蒸気だけを最大にしても雨にならない", () => {
  const result = evaluateRainLightning({
    waterVapor: 100,
    instability: 0,
    updraft: 0,
  });

  assert.equal(result.state, "sunny");
  assert.equal(result.derived.condensationEase, 0);
  assert.equal(result.flags.raining, false);
  assert.equal(result.flags.lightning, false);
});

test("不安定さだけを最大にしても雨にならない", () => {
  const result = evaluateRainLightning({
    waterVapor: 0,
    instability: 100,
    updraft: 0,
  });

  assert.equal(result.state, "sunny");
  assert.equal(result.flags.raining, false);
  assert.equal(result.flags.lightning, false);
});

test("上昇気流だけを最大にしても雷にならない", () => {
  const result = evaluateRainLightning({
    waterVapor: 0,
    instability: 0,
    updraft: 100,
  });

  assert.equal(result.state, "sunny");
  assert.equal(result.derived.icePhaseDevelopment, 0);
  assert.equal(result.derived.chargeSeparation, 0);
  assert.equal(result.flags.lightning, false);
});

test("7つの代表入力が7状態と独立計算値へ対応する", () => {
  for (const sample of representativeCases) {
    const result = evaluateRainLightning(sample.input);
    assert.equal(result.state, sample.state, JSON.stringify(sample.input));
    assert.deepEqual(derivedValues(sample.input), sample.expectedDerived);
  }
});

test("強い雨でも氷相と電荷分離が不足すれば雷を出さない", () => {
  const result = evaluateRainLightning({
    waterVapor: 100,
    instability: 60,
    updraft: 100,
  });

  assert.equal(result.state, "heavy_rain");
  assert.equal(result.flags.raining, true);
  assert.equal(result.flags.heavyRain, true);
  assert.equal(result.flags.thundercloud, false);
  assert.equal(result.flags.lightning, false);
  assert.match(result.explanation, /強い雨だけでは雷は起こりません/);
});

test("雷雲と放電を別判定にする", () => {
  const thundercloud = evaluateRainLightning({
    waterVapor: 90,
    instability: 90,
    updraft: 90,
  });
  const lightning = evaluateRainLightning({
    waterVapor: 95,
    instability: 95,
    updraft: 95,
  });
  const boundaryLightning = evaluateRainLightning({
    waterVapor: 77,
    instability: 97,
    updraft: 99,
  });

  assert.equal(thundercloud.state, "thundercloud");
  assert.equal(thundercloud.flags.thundercloud, true);
  assert.equal(thundercloud.flags.lightning, false);
  assert.ok(
    thundercloud.derived.lightningPotential <
      RAIN_LIGHTNING_THRESHOLDS.LIGHTNING_POTENTIAL_MIN,
  );

  assert.equal(lightning.state, "lightning");
  assert.equal(lightning.flags.thundercloud, true);
  assert.equal(lightning.flags.lightning, true);
  assert.ok(
    lightning.derived.lightningPotential >=
      RAIN_LIGHTNING_THRESHOLDS.LIGHTNING_POTENTIAL_MIN,
  );
  assert.equal(boundaryLightning.state, "lightning");
  assert.equal(
    boundaryLightning.derived.lightningPotential,
    RAIN_LIGHTNING_THRESHOLDS.LIGHTNING_POTENTIAL_MIN,
  );
  assert.match(boundaryLightning.explanation, /目安に達した/);
});

test("降水条件成立時だけ雨表示値を返し、強い雨では密度と速度が増す", () => {
  const cloud = evaluateRainLightning({
    waterVapor: 70,
    instability: 50,
    updraft: 70,
  });
  const rain = evaluateRainLightning({
    waterVapor: 90,
    instability: 60,
    updraft: 80,
  });
  const heavyRain = evaluateRainLightning({
    waterVapor: 100,
    instability: 60,
    updraft: 100,
  });

  assert.equal(cloud.flags.raining, false);
  assert.equal(cloud.rainDropCount, 0);
  assert.equal(cloud.rainSpeed, "stopped");
  assert.equal(rain.flags.raining, true);
  assert.equal(rain.rainDropCount, 24);
  assert.equal(rain.rainSpeed, "gentle");
  assert.equal(heavyRain.rainDropCount, 54);
  assert.equal(heavyRain.rainSpeed, "fast");
});

test("条件を下げると雷から晴れまで決定論的に戻る", () => {
  const sequence: readonly RainLightningInputs[] = [
    { waterVapor: 95, instability: 95, updraft: 95 },
    { waterVapor: 100, instability: 60, updraft: 100 },
    { waterVapor: 90, instability: 60, updraft: 80 },
    { waterVapor: 70, instability: 50, updraft: 70 },
    { waterVapor: 50, instability: 30, updraft: 35 },
    createRainLightningInputs(),
  ];

  assert.deepEqual(
    sequence.map((input) => evaluateRainLightning(input).state),
    [
      "lightning",
      "heavy_rain",
      "rain",
      "cloud_developing",
      "cloud_forming",
      "sunny",
    ],
  );
});

test("入力を0〜100へ制限し、非有限値を拒否する", () => {
  assert.deepEqual(
    normalizeRainLightningInputs({
      waterVapor: -20,
      instability: 140,
      updraft: 50,
    }),
    { waterVapor: 0, instability: 100, updraft: 50 },
  );
  assert.deepEqual(
    setRainLightningInput(stateWith({}), "waterVapor", 200),
    { waterVapor: 100, instability: 20, updraft: 15 },
  );

  for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, -Infinity]) {
    assert.throws(
      () =>
        normalizeRainLightningInputs({
          waterVapor: invalid,
          instability: 20,
          updraft: 15,
        }),
      RangeError,
    );
  }
});

test("同じ入力は毎回同じ派生値・状態・説明を返す", () => {
  const input = { waterVapor: 87, instability: 73, updraft: 82 };

  assert.deepEqual(
    evaluateRainLightning(input),
    evaluateRainLightning(input),
  );
});

test("雲の発達を支えるOR条件は両方が未達なら不足と表示する", () => {
  const instabilityBoundary = evaluateRainLightning({
    waterVapor: 23,
    instability: 35,
    updraft: 44,
  });
  const updraftBoundary = evaluateRainLightning({
    waterVapor: 23,
    instability: 34,
    updraft: 45,
  });
  const bothBelow = evaluateRainLightning({
    waterVapor: 23,
    instability: 34,
    updraft: 44,
  });

  for (const result of [instabilityBoundary, updraftBoundary, bothBelow]) {
    assert.equal(result.state, "cloud_forming");
  }
  assert.equal(
    instabilityBoundary.missingConditions.some((item) =>
      item.label.includes("または"),
    ),
    false,
  );
  assert.equal(
    updraftBoundary.missingConditions.some((item) =>
      item.label.includes("または"),
    ),
    false,
  );
  assert.ok(
    bothBelow.missingConditions.some(
      (item) => item.current === 44 && item.threshold === 45,
    ),
  );
});

test("雨状態では雷雲ゲートの実際の不足項目を説明する", () => {
  const result = evaluateRainLightning({
    waterVapor: 48,
    instability: 97,
    updraft: 100,
  });

  assert.equal(result.state, "rain");
  assert.ok(
    result.derived.icePhaseDevelopment >=
      RAIN_LIGHTNING_THRESHOLDS.THUNDERCLOUD_ICE_PHASE_MIN,
  );
  assert.ok(
    result.derived.chargeSeparation >=
      RAIN_LIGHTNING_THRESHOLDS.THUNDERCLOUD_CHARGE_MIN,
  );
  assert.match(result.explanation, /雲の発達度が不足/);
  assert.doesNotMatch(result.explanation, /氷相や電荷分離が不足/);
});

test("雲発達状態の説明は粒が足りていても降水不足と一致する", () => {
  const result = evaluateRainLightning({
    waterVapor: 40,
    instability: 100,
    updraft: 100,
  });

  assert.equal(result.state, "cloud_developing");
  assert.ok(
    result.derived.particleGrowth >=
      RAIN_LIGHTNING_THRESHOLDS.RAIN_PARTICLE_GROWTH_MIN,
  );
  assert.ok(
    result.derived.precipitationIntensity <
      RAIN_LIGHTNING_THRESHOLDS.RAIN_PRECIPITATION_MIN,
  );
  assert.match(result.explanation, /降水強度がまだ不足/);
  assert.doesNotMatch(result.explanation, /粒の成長はまだ不足/);
});

test("モデルと表示実装にeval・Function・ランダム値を含めない", async () => {
  const model = await readFile(
    new URL("../app/data/rain-lightning.ts", import.meta.url),
    "utf8",
  );
  const component = await readFile(
    new URL("../app/RainLightningLab.tsx", import.meta.url),
    "utf8",
  );
  const forbiddenCalls = [
    new RegExp(`\\b${["ev", "al"].join("")}\\s*\\(`, "u"),
    new RegExp(`\\bnew\\s+${["Func", "tion"].join("")}\\s*\\(`, "u"),
    new RegExp(`\\b${["Math", "random"].join("\\.")}\\s*\\(`, "u"),
  ];

  for (const source of [model, component]) {
    for (const forbiddenCall of forbiddenCalls) {
      assert.equal(forbiddenCall.test(source), false, forbiddenCall.source);
    }
  }
});

test("公開シェルから飛行機を外し、雨・雷の導線だけを表示する", async () => {
  const shell = await readFile(
    new URL("../app/VolcanoLab.tsx", import.meta.url),
    "utf8",
  );

  assert.equal(shell.includes("SpiderPlaneLab"), false);
  assert.equal(shell.includes("spider-experiment"), false);
  assert.equal(shell.includes("クモ糸×飛行機"), false);
  assert.equal(shell.includes("飛行機"), false);
  assert.match(shell, /RainLightningLab/);
  assert.match(shell, /rain-lightning-experiment/);
});

test("雨粒・電荷・稲妻は計算フラグに従い、reduced-motionで点滅を止める", async () => {
  const component = await readFile(
    new URL("../app/RainLightningLab.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../app/RainLightningLab.module.css", import.meta.url),
    "utf8",
  );
  const reducedMotion = css.slice(
    css.indexOf("@media (prefers-reduced-motion: reduce)"),
  );

  assert.match(component, /result\.flags\.raining &&/);
  assert.match(component, /result\.flags\.thundercloud &&/);
  assert.match(component, /result\.flags\.lightning &&/);
  assert.match(component, /data-rain-drop="true"/);
  assert.match(component, /data-lightning-bolt="visible"/);
  assert.match(component, /role="meter"/);
  assert.ok(reducedMotion.length > 0);
  assert.match(reducedMotion, /\.wxRainDrop[\s\S]*display: none/);
  assert.match(reducedMotion, /\.wxLightning i[\s\S]*animation: none !important/);
  assert.match(reducedMotion, /\.wxLightning i[\s\S]*opacity: 0\.5/);
});
