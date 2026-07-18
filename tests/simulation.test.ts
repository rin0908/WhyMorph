import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { VOLCANO_SCENARIO } from "../app/data/volcano";
import type { VolcanoMissionId } from "../app/data/volcano";
import {
  COMPARISON_OPERATORS,
  NUMERIC_OPERATORS,
  applyVariableDelta,
  computeDerivedMetrics,
  createInitialSimulationState,
  evaluateCondition,
  evaluateNumericExpression,
  evaluateScenario,
  evaluateSimulation,
  resetSimulation,
  setSimulationVariable,
} from "../app/lib/simulation";
import type {
  Condition,
  NumericExpression,
  NumericOperator,
  ScenarioDefinition,
  SimulationVariables,
} from "../app/lib/simulation";
import { ScenarioOutputSchema } from "../app/lib/scenario-schema";

const literal = (value: number): NumericExpression => ({
  type: "literal",
  value,
});

const operation = (
  operator: NumericOperator,
  left: NumericExpression,
  right: NumericExpression,
): NumericExpression => ({
  type: "operation",
  operator,
  left,
  right,
});

const stateWith = (variables: SimulationVariables) => ({
  variables,
  missionId: "stabilize_chamber" as const,
});

test("初期状態とリセット値はシナリオデータから生成される", () => {
  const initial = createInitialSimulationState(VOLCANO_SCENARIO);
  const reset = resetSimulation(VOLCANO_SCENARIO);

  assert.deepEqual(initial.variables, {
    magma: 76,
    gas: 82,
    blockage: 72,
  });
  assert.deepEqual(initial.variables, VOLCANO_SCENARIO.reset.variables);
  assert.deepEqual(reset, initial);
  assert.notStrictEqual(initial.variables, VOLCANO_SCENARIO.reset.variables);
  assert.notStrictEqual(reset.variables, initial.variables);
});

test("pressureは宣言的な式から80.9と算出される", () => {
  const derived = computeDerivedMetrics(VOLCANO_SCENARIO, {
    magma: 76,
    gas: 82,
    blockage: 72,
  });
  assert.equal(derived.pressure, 80.9);

  const result = evaluateSimulation(
    VOLCANO_SCENARIO,
    createInitialSimulationState(VOLCANO_SCENARIO),
  );
  assert.equal(result.derived.pressure, 80.9);
  assert.equal(result.alert.id, "critical");
  assert.equal(result.eruption, false);
  assert.equal(result.mission.status, "active");
});

test("圧力に応じて全警戒段階が選択される", () => {
  const cases: Array<[SimulationVariables, string]> = [
    [{ magma: 20, gas: 20, blockage: 20 }, "stable"],
    [{ magma: 50, gas: 50, blockage: 50 }, "watch"],
    [{ magma: 70, gas: 70, blockage: 70 }, "warning"],
    [{ magma: 80, gas: 80, blockage: 80 }, "critical"],
  ];

  for (const [variables, expected] of cases) {
    const result = evaluateSimulation(
      VOLCANO_SCENARIO,
      stateWith(variables),
    );
    assert.equal(result.alert.id, expected);
  }
});

test("ミッション成功と噴火失敗がルールから判定される", () => {
  const success = evaluateScenario(VOLCANO_SCENARIO, {
    magma: 30,
    gas: 40,
    blockage: 35,
  });
  assert.equal(success.derived.pressure, 36.5);
  assert.equal(success.eruption, false);
  assert.equal(success.mission.status, "success");

  const failure = evaluateScenario(VOLCANO_SCENARIO, {
    magma: 100,
    gas: 100,
    blockage: 100,
  });
  assert.equal(failure.derived.pressure, 100);
  assert.equal(failure.eruption, true);
  assert.equal(failure.mission.status, "failure");
  assert.ok(failure.eruptionMessage);
});

test("成功条件と失敗条件が同時成立した場合は失敗が優先される", () => {
  const scenario = {
    ...VOLCANO_SCENARIO,
    missions: VOLCANO_SCENARIO.missions.map((mission) => ({
      ...mission,
      success: {
        ...mission.success,
        when: VOLCANO_SCENARIO.eruption.when,
      },
    })),
  } satisfies ScenarioDefinition<VolcanoMissionId>;

  const result = evaluateScenario(scenario, {
    magma: 100,
    gas: 100,
    blockage: 100,
  });
  assert.equal(result.mission.status, "failure");
});

test("変数更新はimmutableでシナリオ範囲に収まる", () => {
  const initial = createInitialSimulationState(VOLCANO_SCENARIO);
  const lowered = setSimulationVariable(
    VOLCANO_SCENARIO,
    initial,
    "gas",
    -20,
  );
  const raised = setSimulationVariable(
    VOLCANO_SCENARIO,
    lowered,
    "magma",
    500,
  );
  const deltaApplied = applyVariableDelta(
    raised,
    "blockage",
    500,
  );

  assert.equal(initial.variables.gas, 82);
  assert.equal(lowered.variables.gas, 0);
  assert.equal(raised.variables.magma, 100);
  assert.equal(deltaApplied.variables.blockage, 100);
  assert.notStrictEqual(lowered, initial);
  assert.notStrictEqual(lowered.variables, initial.variables);
  assert.throws(
    () =>
      setSimulationVariable(
        VOLCANO_SCENARIO,
        initial,
        "magma",
        Number.NaN,
      ),
    /finite number/,
  );
});

test("許可された演算だけを評価しゼロ除算を拒否する", () => {
  const metrics = {
    magma: 8,
    gas: 2,
    blockage: 5,
    pressure: 10,
  };
  const cases: Array<[NumericExpression, number]> = [
    [operation("add", literal(8), literal(2)), 10],
    [operation("subtract", literal(8), literal(2)), 6],
    [operation("multiply", literal(8), literal(2)), 16],
    [operation("divide", literal(8), literal(2)), 4],
    [operation("min", literal(8), literal(2)), 2],
    [operation("max", literal(8), literal(2)), 8],
  ];

  assert.deepEqual(NUMERIC_OPERATORS, [
    "add",
    "subtract",
    "multiply",
    "divide",
    "min",
    "max",
  ]);
  assert.deepEqual(COMPARISON_OPERATORS, [
    "lt",
    "lte",
    "eq",
    "neq",
    "gte",
    "gt",
  ]);

  for (const [expression, expected] of cases) {
    assert.equal(
      evaluateNumericExpression(expression, metrics),
      expected,
    );
  }
  assert.throws(
    () =>
      evaluateNumericExpression(
        operation("divide", literal(1), literal(0)),
        metrics,
      ),
    /Division by zero/,
  );
});

test("未許可の数値・比較演算子を実行時にも拒否する", () => {
  const metrics = {
    magma: 1,
    gas: 2,
    blockage: 3,
    pressure: 4,
  };
  const invalidExpression = {
    type: "operation",
    operator: "power",
    left: literal(2),
    right: literal(8),
  } as unknown as NumericExpression;
  const invalidCondition = {
    type: "compare",
    operator: "contains",
    left: { type: "metric", metric: "pressure" },
    right: literal(1),
  } as unknown as Condition;

  assert.throws(
    () => evaluateNumericExpression(invalidExpression, metrics),
    /Unsupported numeric operator/,
  );
  assert.throws(
    () => evaluateCondition(invalidCondition, metrics),
    /Unsupported comparison operator/,
  );
});

test("派生値の循環参照を拒否する", () => {
  const scenario = {
    ...VOLCANO_SCENARIO,
    derived: {
      pressure: {
        ...VOLCANO_SCENARIO.derived.pressure,
        expression: {
          type: "metric",
          metric: "pressure",
        },
      },
    },
  } as const satisfies ScenarioDefinition<VolcanoMissionId>;

  assert.throws(
    () =>
      computeDerivedMetrics(
        scenario,
        VOLCANO_SCENARIO.reset.variables,
      ),
    /Circular derived metric rule/,
  );
});

test("Zod生成スキーマと実行エンジンの型・内容が一致する", () => {
  const parsed: ScenarioDefinition =
    ScenarioOutputSchema.parse(VOLCANO_SCENARIO);
  const result = evaluateScenario(parsed, parsed.reset.variables);

  assert.equal(parsed.location, "霧島・新燃岳 観測所");
  assert.equal(result.derived.pressure, 80.9);
});

test("エンジンに動的コード実行経路が存在しない", async () => {
  const source = await readFile(
    new URL("../app/lib/simulation.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /\beval\s*\(/);
  assert.doesNotMatch(source, /\bnew\s+Function\s*\(/);
});
