import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { VOLCANO_SCENARIO } from "../app/data/volcano";
import {
  SPIDER_PLANE_DISCLAIMER,
  SPIDER_PLANE_SCENARIO,
  SPIDER_PLANE_VARIABLE_KEYS,
  SpiderPlaneValidationError,
  createSpiderPlaneState,
  decideSpiderPlaneMotion,
  degreesToRadians,
  evaluateSpiderPlane,
  megapascalsToPascals,
  micrometersToMeters,
  setSpiderPlaneVariable,
  validateSpiderPlaneState,
  type SpiderPlaneVariables,
} from "../app/data/spider-plane";
import { evaluateScenario } from "../app/lib/simulation";

const stateWith = (
  changes: Partial<SpiderPlaneVariables>,
): SpiderPlaneVariables => ({
  ...createSpiderPlaneState(),
  ...changes,
});

const closeTo = (actual: number, expected: number, tolerance = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} should be within ${tolerance} of ${expected}`,
  );
};

test("初期対象は実物の737-8で、公式上限質量を具体的に表示する", () => {
  const state = createSpiderPlaneState();

  assert.equal(SPIDER_PLANE_SCENARIO.subject, "実物旅客機：Boeing 737-8");
  assert.equal(state.massKg, 82_871);
  assert.match(SPIDER_PLANE_SCENARIO.massBasis, /82,871 kg/);
  assert.equal(
    SPIDER_PLANE_DISCLAIMER,
    "教育用の簡略モデルです。結果は入力した仮定に依存し、実際の航空機牽引設計には使用できません。",
  );
});

test("初期値は独立手計算と一致し、糸1本では絶対に動かない", () => {
  const result = evaluateSpiderPlane(createSpiderPlaneState());

  closeTo(result.rollingResistance, 16_253.737843, 1e-9);
  closeTo(result.slopeForce, 0);
  closeTo(result.accelerationForce, 1_657.42, 1e-9);
  closeTo(result.requiredForce, 17_911.157843, 1e-9);
  closeTo(result.threadArea, 7.853981633974483e-11, 1e-22);
  closeTo(result.singleThreadBreakingForce, 0.07853981633974483, 1e-14);
  closeTo(result.effectiveBreakingForcePerThread, 0.039269908169872414, 1e-14);
  closeTo(result.safeForcePerThread, 0.01308996938995747, 1e-14);
  assert.equal(result.breakingThreadCount, 456_104);
  assert.equal(result.requiredThreadCount, 1_368_312);
  assert.equal(result.status, "snapped");
  assert.equal(result.threadBreaks, true);
  assert.equal(result.planeMoves, false);
  assert.equal(result.headline, "必要本数に大きく不足");
  assert.match(result.explanation, /0\.03927 N/);
});

test("糸2本でも不適切に飛行機を動かさない", () => {
  const result = evaluateSpiderPlane(stateWith({ threadCount: 2 }));

  assert.equal(result.status, "snapped");
  assert.equal(result.threadBreaks, true);
  assert.equal(result.planeMoves, false);
  assert.ok(result.bundleBreakingForce < result.requiredForce);
});

test("破断回避本数より1本少なければ糸だけが切れ、機体は動かない", () => {
  const baseline = evaluateSpiderPlane(createSpiderPlaneState());
  assert.ok(baseline.breakingThreadCount !== null);
  const result = evaluateSpiderPlane(
    stateWith({ threadCount: baseline.breakingThreadCount - 1 }),
  );

  assert.equal(result.status, "snapped");
  assert.equal(result.threadBreaks, true);
  assert.equal(result.planeMoves, false);
});

test("破断は避けても必要本数未満なら安全率不足で動かない", () => {
  const baseline = evaluateSpiderPlane(createSpiderPlaneState());
  assert.ok(baseline.breakingThreadCount !== null);
  assert.ok(baseline.requiredThreadCount !== null);
  const result = evaluateSpiderPlane(
    stateWith({ threadCount: baseline.breakingThreadCount }),
  );

  assert.equal(result.threadBreaks, false);
  assert.equal(result.status, "unsafe");
  assert.equal(result.planeMoves, false);
  assert.ok(result.bundleSafeForce < result.requiredForce);
  assert.ok(baseline.breakingThreadCount < baseline.requiredThreadCount);
});

test("必要本数より1本少なければ動かず、必要本数ちょうどでだけ動く", () => {
  const baseline = evaluateSpiderPlane(createSpiderPlaneState());
  assert.ok(baseline.requiredThreadCount !== null);

  const short = evaluateSpiderPlane(
    stateWith({ threadCount: baseline.requiredThreadCount - 1 }),
  );
  const enough = evaluateSpiderPlane(
    stateWith({ threadCount: baseline.requiredThreadCount }),
  );

  assert.equal(short.status, "unsafe");
  assert.equal(short.threadBreaks, false);
  assert.equal(short.planeMoves, false);
  assert.equal(enough.status, "moved");
  assert.equal(enough.threadBreaks, false);
  assert.equal(enough.planeMoves, true);
  assert.ok(enough.bundleSafeForce >= enough.requiredForce);
});

test("破断フラグがある矛盾した中間状態でも安全ゲートは移動を拒否する", () => {
  assert.deepEqual(
    decideSpiderPlaneMotion({
      attachmentFailed: false,
      threadBreaks: true,
      hasRequiredThreadCount: true,
      hasSafeCapacity: true,
    }),
    { status: "snapped", planeMoves: false },
  );
});

test("固定不能は破断と分離し、安全ゲートが移動を拒否する", () => {
  assert.deepEqual(
    decideSpiderPlaneMotion({
      attachmentFailed: true,
      threadBreaks: false,
      hasRequiredThreadCount: false,
      hasSafeCapacity: false,
    }),
    { status: "detached", planeMoves: false },
  );
});

test("必要本数以上なら破断しないことをモデルの不変条件として確認する", () => {
  const baseline = evaluateSpiderPlane(createSpiderPlaneState());
  assert.ok(baseline.requiredThreadCount !== null);
  const result = evaluateSpiderPlane(
    stateWith({ threadCount: baseline.requiredThreadCount + 100_000 }),
  );

  assert.equal(result.threadBreaks, false);
  assert.equal(result.planeMoves, true);
  assert.ok(result.bundleBreakingForce > result.bundleSafeForce);
});

test("µm→m、MPa→Pa、度→radの単位変換が正しい", () => {
  closeTo(micrometersToMeters(10), 1e-5, 1e-18);
  assert.equal(megapascalsToPascals(1_000), 1e9);
  closeTo(degreesToRadians(180), Math.PI, 1e-15);
  closeTo(degreesToRadians(1), Math.PI / 180, 1e-15);
});

test("傾斜力は mass × gravity × sin(angle) と一致する", () => {
  const state = stateWith({ slopeAngleDegrees: 1 });
  const result = evaluateSpiderPlane(state);
  const expected =
    state.massKg *
    SPIDER_PLANE_SCENARIO.gravityMetersPerSecondSquared *
    Math.sin(Math.PI / 180);

  closeTo(result.slopeForce, expected, 1e-9);
  closeTo(
    result.requiredForce,
    result.rollingResistance + result.slopeForce + result.accelerationForce,
    1e-9,
  );
});

test("固定効率0は破断とせず、固定不能・必要本数∞・移動不可として扱う", () => {
  const result = evaluateSpiderPlane(stateWith({ attachmentEfficiency: 0 }));

  assert.equal(result.safeForcePerThread, 0);
  assert.equal(result.effectiveBreakingForcePerThread, 0);
  assert.equal(result.requiredThreadCount, null);
  assert.equal(result.breakingThreadCount, null);
  assert.equal(result.status, "detached");
  assert.equal(result.failureMode, "attachment_failed");
  assert.equal(result.threadBreaks, false);
  assert.equal(result.planeMoves, false);
  assert.match(result.explanation, /固定部が外れた状態/);
});

test("固定効率と安全率は糸1本の安全使用力へ反映される", () => {
  const ideal = evaluateSpiderPlane(
    stateWith({ attachmentEfficiency: 1, safetyFactor: 1 }),
  );
  const conservative = evaluateSpiderPlane(
    stateWith({ attachmentEfficiency: 0.5, safetyFactor: 5 }),
  );

  closeTo(ideal.safeForcePerThread, ideal.singleThreadBreakingForce, 1e-14);
  closeTo(
    conservative.safeForcePerThread,
    conservative.singleThreadBreakingForce * 0.5 / 5,
    1e-14,
  );
  assert.ok(
    conservative.requiredThreadCount !== null &&
      ideal.requiredThreadCount !== null &&
      conservative.requiredThreadCount > ideal.requiredThreadCount,
  );
});

test("ゼロ・負数・NaN・Infinity・範囲外・小数本を拒否する", () => {
  const invalidStates: SpiderPlaneVariables[] = [
    stateWith({ massKg: 0 }),
    stateWith({ massKg: -1 }),
    stateWith({ massKg: Number.NaN }),
    stateWith({ massKg: Number.POSITIVE_INFINITY }),
    stateWith({ massKg: 82_872 }),
    stateWith({ rollingResistanceCoefficient: 0 }),
    stateWith({ rollingResistanceCoefficient: 0.021 }),
    stateWith({ slopeAngleDegrees: -0.1 }),
    stateWith({ targetAccelerationMetersPerSecondSquared: 0 }),
    stateWith({ threadDiameterMicrometers: 0 }),
    stateWith({ tensileStrengthMegapascals: -1 }),
    stateWith({ safetyFactor: 0 }),
    stateWith({ attachmentEfficiency: -0.1 }),
    stateWith({ attachmentEfficiency: 1.1 }),
    stateWith({ threadCount: 0 }),
    stateWith({ threadCount: 1.5 }),
    stateWith({ threadCount: 100_000_001 }),
  ];

  for (const invalid of invalidStates) {
    assert.ok(validateSpiderPlaneState(invalid).length > 0);
    assert.throws(() => evaluateSpiderPlane(invalid), SpiderPlaneValidationError);
  }
});

test("9入力は定義したmin・maxを受理し、その直外を拒否する", () => {
  for (const key of SPIDER_PLANE_VARIABLE_KEYS) {
    const definition = SPIDER_PLANE_SCENARIO.variables[key];
    for (const value of [definition.min, definition.max]) {
      const boundary = stateWith({
        [key]: value,
      } as Partial<SpiderPlaneVariables>);
      assert.equal(validateSpiderPlaneState(boundary).length, 0, `${key}=${value}`);
      assert.doesNotThrow(() => evaluateSpiderPlane(boundary));
    }

    const below = stateWith({
      [key]: definition.min - definition.step,
    } as Partial<SpiderPlaneVariables>);
    const above = stateWith({
      [key]: definition.max + definition.step,
    } as Partial<SpiderPlaneVariables>);
    assert.ok(validateSpiderPlaneState(below).some((issue) => issue.key === key));
    assert.ok(validateSpiderPlaneState(above).some((issue) => issue.key === key));
  }
});

test("非既定値でも加速力・必要力・必要本数が独立計算と一致する", () => {
  const state = stateWith({
    massKg: 60_000,
    rollingResistanceCoefficient: 0.015,
    slopeAngleDegrees: 1,
    targetAccelerationMetersPerSecondSquared: 0.03,
    threadDiameterMicrometers: 9,
    tensileStrengthMegapascals: 900,
    safetyFactor: 4,
    attachmentEfficiency: 0.75,
  });
  const result = evaluateSpiderPlane(state);
  const gravity = SPIDER_PLANE_SCENARIO.gravityMetersPerSecondSquared;
  const rolling = 0.015 * 60_000 * gravity;
  const slope = 60_000 * gravity * Math.sin(Math.PI / 180);
  const acceleration = 60_000 * 0.03;
  const area = Math.PI * ((9e-6) / 2) ** 2;
  const safePerThread = (900e6 * area * 0.75) / 4;

  closeTo(result.accelerationForce, acceleration, 1e-9);
  closeTo(result.requiredForce, rolling + slope + acceleration, 1e-9);
  assert.equal(
    result.requiredThreadCount,
    Math.ceil((rolling + slope + acceleration) / safePerThread),
  );
});

test("変数更新は元の状態を変更せず、異常値を静かに丸めない", () => {
  const original = createSpiderPlaneState();
  const updated = setSpiderPlaneVariable(original, "threadCount", 2);

  assert.equal(original.threadCount, 1);
  assert.equal(updated.threadCount, 2);
  assert.notStrictEqual(original, updated);
  assert.throws(
    () => setSpiderPlaneVariable(updated, "threadCount", -100),
    SpiderPlaneValidationError,
  );
});

test("飛行機モデルにevalまたはFunctionコンストラクタがない", () => {
  const source = readFileSync(
    new URL("../app/data/spider-plane.ts", import.meta.url),
    "utf8",
  );

  assert.equal(/\beval\s*\(/.test(source), false);
  assert.equal(/new\s+Function\s*\(/.test(source), false);
});

test("飛行機の破断・不足・移動計算は火山シナリオへ副作用を与えない", () => {
  const before = evaluateScenario(
    VOLCANO_SCENARIO,
    VOLCANO_SCENARIO.reset.variables,
  );
  const resetBefore = { ...VOLCANO_SCENARIO.reset.variables };
  const baseline = evaluateSpiderPlane(createSpiderPlaneState());

  assert.ok(baseline.breakingThreadCount !== null);
  assert.ok(baseline.requiredThreadCount !== null);
  evaluateSpiderPlane(stateWith({ threadCount: 1 }));
  evaluateSpiderPlane(
    stateWith({ threadCount: baseline.breakingThreadCount }),
  );
  evaluateSpiderPlane(
    stateWith({ threadCount: baseline.requiredThreadCount }),
  );

  const after = evaluateScenario(
    VOLCANO_SCENARIO,
    VOLCANO_SCENARIO.reset.variables,
  );
  assert.deepEqual(after, before);
  assert.deepEqual(VOLCANO_SCENARIO.reset.variables, resetBefore);
  assert.equal(after.derived.pressure, 80.9);
  assert.equal(after.alert.level, 4);
  assert.equal(after.eruption, false);
});

test("実写機体レイヤーだけを移動し、滑走路背景は静止させる", () => {
  const component = readFileSync(
    new URL("../app/SpiderPlaneLab.tsx", import.meta.url),
    "utf8",
  );
  const styles = readFileSync(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  assert.match(component, /className="spider-runway-backdrop"/);
  assert.match(component, /className="spider-aircraft-layer"/);
  assert.match(component, /clipPathUnits="userSpaceOnUse"/);
  assert.match(component, /clipRule="evenodd"/);
  assert.match(component, /href="\/boeing-737-taxi-cc-by-sa-4\.jpg"/);
  assert.match(component, /className="spider-sr-result"/);
  assert.match(component, /result\.failureMode === "attachment_failed"/);
  assert.doesNotMatch(component, /className="spider-dominant" aria-live=/);
  assert.match(styles, /\.spider-aircraft-layer\{[^}]*transform:translateX\(calc\(-4% \+ var\(--spider-plane-shift\)\)\) scale\(\.88\)/);
  assert.doesNotMatch(
    styles,
    /\.spider-runway-backdrop\{[^}]*translateX\(var\(--spider-plane-shift\)\)/,
  );
  assert.match(
    styles,
    /\.spider-stage\[data-plane-moves="true"\]\{--spider-plane-shift:18px\}/,
  );
  assert.match(
    styles,
    /\.spider-thread-rig\{[^}]*left:calc\(75% \+ var\(--spider-plane-shift\)\)/,
  );
  assert.match(styles, /\.spider-photo-credit\{[^}]*font-size:10px/);
  assert.match(styles, /\.spider-thread-count strong\{font-size:10px\}/);
  assert.match(
    styles,
    /prefers-reduced-motion:reduce[^}]*\.spider-aircraft-layer[^}]*transition:none!important/,
  );
});
