import assert from "node:assert/strict";
import test from "node:test";

import {
  SPIDER_PLANE_SCENARIO,
  createSpiderPlaneState,
  evaluateSpiderPlane,
  sanitizeSpiderPlaneState,
  setSpiderPlaneVariable,
  type SpiderPlaneVariables,
} from "../app/data/spider-plane";

const stateWith = (
  changes: Partial<SpiderPlaneVariables>,
): SpiderPlaneVariables => ({
  ...createSpiderPlaneState(),
  ...changes,
});

test("初期値は糸1本で動かず、必要本数を表示する", () => {
  const state = createSpiderPlaneState();
  const result = evaluateSpiderPlane(state);

  assert.deepEqual(state, SPIDER_PLANE_SCENARIO.reset);
  assert.notStrictEqual(state, SPIDER_PLANE_SCENARIO.reset);
  assert.equal(result.status, "still");
  assert.equal(result.headline, "動かない");
  assert.equal(result.totalPull, 5);
  assert.equal(result.totalStrength, 12);
  assert.equal(result.frictionForce, 39.2);
  assert.equal(result.requiredThreadCount, 8);
  assert.equal(result.movementPercent, 0);
});

test("6本・7Nでは飛行機が少し動く", () => {
  const result = evaluateSpiderPlane(
    stateWith({ threadCount: 6, pullForce: 7 }),
  );

  assert.equal(result.status, "small");
  assert.equal(result.headline, "少し動く");
  assert.equal(result.totalPull, 42);
  assert.ok(Math.abs(result.distanceMeters - 0.063) < 0.000001);
  assert.ok(result.movementPercent > 0);
  assert.ok(result.movementPercent < 45);
});

test("20本・7Nでは飛行機が大きく動く", () => {
  const result = evaluateSpiderPlane(
    stateWith({ threadCount: 20, pullForce: 7 }),
  );

  assert.equal(result.status, "moved");
  assert.equal(result.headline, "動いた！");
  assert.equal(result.totalPull, 140);
  assert.ok(Math.abs(result.distanceMeters - 2.268) < 0.000001);
  assert.ok(result.movementPercent >= 45);
});

test("1本あたりの引く力が強さを超えると糸が切れる", () => {
  const result = evaluateSpiderPlane(
    stateWith({ threadCount: 20, threadStrength: 12, pullForce: 15 }),
  );

  assert.equal(result.status, "snapped");
  assert.equal(result.headline, "糸が切れた！");
  assert.equal(result.totalPull, 300);
  assert.equal(result.totalStrength, 240);
  assert.equal(result.netForce, 0);
  assert.equal(result.distanceMeters, 0);
  assert.equal(result.requiredThreadCount, null);
});

test("引く力と糸の強さが同じなら切れない", () => {
  const result = evaluateSpiderPlane(
    stateWith({ threadCount: 20, threadStrength: 12, pullForce: 12 }),
  );

  assert.notEqual(result.status, "snapped");
  assert.equal(result.totalPull, result.totalStrength);
});

test("質量や摩擦が増えると、動かすための必要本数が増える", () => {
  const light = evaluateSpiderPlane(
    stateWith({ planeMass: 100, friction: 1, pullForce: 5 }),
  );
  const heavy = evaluateSpiderPlane(
    stateWith({ planeMass: 500, friction: 10, pullForce: 5 }),
  );

  assert.ok(light.requiredThreadCount !== null);
  assert.ok(heavy.requiredThreadCount !== null);
  assert.ok(heavy.requiredThreadCount > light.requiredThreadCount);
});

test("異常値と範囲外の値を安全な範囲へ戻す", () => {
  const sanitized = sanitizeSpiderPlaneState({
    threadCount: 999,
    threadStrength: -20,
    pullForce: Number.POSITIVE_INFINITY,
    planeMass: Number.NaN,
    friction: 0,
  });

  assert.deepEqual(sanitized, {
    threadCount: 60,
    threadStrength: 1,
    pullForce: 5,
    planeMass: 200,
    friction: 1,
  });
  for (const value of Object.values(sanitized)) {
    assert.equal(Number.isFinite(value), true);
  }
});

test("変数更新は元の状態を変更せず、刻みと範囲を守る", () => {
  const original = createSpiderPlaneState();
  const updated = setSpiderPlaneVariable(original, "threadCount", 6.4);
  const clamped = setSpiderPlaneVariable(updated, "planeMass", 9999);

  assert.equal(original.threadCount, 1);
  assert.equal(updated.threadCount, 6);
  assert.equal(clamped.planeMass, 500);
  assert.notStrictEqual(original, updated);
  assert.notStrictEqual(updated, clamped);
});

test("4状態の判定順は安全な宣言ルールとして保持される", () => {
  assert.deepEqual(
    SPIDER_PLANE_SCENARIO.rules.map((rule) => ({
      status: rule.status,
      operator: rule.operator,
    })),
    [
      { status: "snapped", operator: "gt" },
      { status: "still", operator: "lte" },
      { status: "small", operator: "lt" },
      { status: "moved", operator: "always" },
    ],
  );
});

test("いちばん影響した条件は現在値から変化する", () => {
  const noPull = evaluateSpiderPlane(
    stateWith({ threadCount: 60, pullForce: 0 }),
  );
  const moving = evaluateSpiderPlane(
    stateWith({ threadCount: 20, pullForce: 7 }),
  );
  const weakThread = evaluateSpiderPlane(
    stateWith({ threadStrength: 1, pullForce: 5 }),
  );
  const excessivePull = evaluateSpiderPlane(
    stateWith({ threadStrength: 25, pullForce: 30 }),
  );

  assert.equal(noPull.dominantCondition, "引く力");
  assert.equal(moving.dominantCondition, "引く力");
  assert.equal(weakThread.dominantCondition, "糸1本あたりの強さ");
  assert.equal(excessivePull.dominantCondition, "引く力");
});
