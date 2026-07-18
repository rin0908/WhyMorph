import type {
  Condition,
  MetricKey,
  NumericExpression,
  NumericOperator,
  ScenarioDefinition,
  SimulationVariables,
} from "../lib/simulation";

export type VolcanoMissionId = "stabilize_chamber";

const literal = (value: number): NumericExpression => ({
  type: "literal",
  value,
});

const metric = (metricName: MetricKey): NumericExpression => ({
  type: "metric",
  metric: metricName,
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

const compare = (
  key: MetricKey,
  operator: "lt" | "lte" | "gte" | "gt",
  value: number,
): Condition => ({
  type: "compare",
  left: metric(key),
  operator,
  right: literal(value),
});

const pressure: NumericExpression = {
  type: "clamp",
  min: 0,
  max: 100,
  value: operation(
    "add",
    operation(
      "add",
      operation("multiply", metric("magma"), literal(0.42)),
      operation("multiply", metric("gas"), literal(0.36)),
    ),
    operation("multiply", metric("blockage"), literal(0.27)),
  ),
};

const eruption: Condition = {
  type: "any",
  conditions: [
    compare("pressure", "gte", 92),
    {
      type: "all",
      conditions: [
        compare("pressure", "gte", 85),
        compare("gas", "gte", 82),
        compare("blockage", "gte", 78),
      ],
    },
  ],
};

const resetVariables: SimulationVariables = {
  magma: 76,
  gas: 82,
  blockage: 72,
};

export const VOLCANO_SCENARIO = {
  id: "shinmoe_observatory",
  title: "火山危機管理シミュレーション",
  location: "霧島・新燃岳 観測所",
  variables: {
    magma: {
      label: "マグマ供給量",
      shortLabel: "マグマ",
      unit: "%",
      description: "地下深部から火口直下へ流れ込むマグマの勢い",
      min: 0,
      max: 100,
      step: 1,
      accent: "#ff6846",
    },
    gas: {
      label: "火山ガス濃度",
      shortLabel: "ガス",
      unit: "%",
      description: "マグマから分離し、火道内に蓄積しているガスの量",
      min: 0,
      max: 100,
      step: 1,
      accent: "#ffc857",
    },
    blockage: {
      label: "火道閉塞率",
      shortLabel: "閉塞",
      unit: "%",
      description: "冷えた溶岩や岩片が火道を塞いでいる割合",
      min: 0,
      max: 100,
      step: 1,
      accent: "#9f8cff",
    },
  },
  derived: {
    pressure: {
      label: "火道内圧力",
      unit: "%",
      min: 0,
      max: 100,
      precision: 1,
      description: "マグマ・ガス・閉塞の組み合わせから算出する危険圧力",
      expression: pressure,
    },
  },
  alertStages: [
    {
      id: "stable",
      level: 1,
      label: "安定",
      color: "#53d69d",
      headline: "火山活動は安定しています",
      description: "観測を継続しながら通常体制を維持してください。",
      when: compare("pressure", "lt", 35),
    },
    {
      id: "watch",
      level: 2,
      label: "注意",
      color: "#f4c95d",
      headline: "圧力の上昇を検知",
      description: "ガス放出と火道の状態を重点的に監視してください。",
      when: compare("pressure", "lt", 55),
    },
    {
      id: "warning",
      level: 3,
      label: "警戒",
      color: "#ff8a4c",
      headline: "噴火リスクが高まっています",
      description: "避難準備を開始し、圧力低下策を急いでください。",
      when: compare("pressure", "lt", 75),
    },
    {
      id: "critical",
      level: 4,
      label: "緊急",
      color: "#ff4d67",
      headline: "噴火切迫レベル",
      description: "直ちに危機対応へ移行し、安全確保を最優先してください。",
      when: null,
    },
  ],
  eruption: {
    title: "噴火発生",
    message:
      "火道内圧力が限界を超えました。緊急避難プロトコルを実行してください。",
    when: eruption,
  },
  missions: [
    {
      id: "stabilize_chamber",
      title: "ミッション：火山を安定化せよ",
      objective:
        "噴火を起こさず、圧力42%以下・ガス55%以下・閉塞50%以下に下げる",
      activeMessage:
        "3つの制御値を調整して、火道内圧力を安全圏へ導いてください。",
      success: {
        title: "ミッション成功",
        message:
          "火道内圧力が安全圏まで低下しました。安定監視へ移行します。",
        when: {
          type: "all",
          conditions: [
            compare("pressure", "lte", 42),
            compare("gas", "lte", 55),
            compare("blockage", "lte", 50),
          ],
        },
      },
      failure: {
        title: "ミッション失敗",
        message:
          "噴火が発生しました。初期状態に戻して別の制御手順を試してください。",
        when: eruption,
      },
    },
  ],
  reset: {
    variables: resetVariables,
    missionId: "stabilize_chamber",
  },
} as const satisfies ScenarioDefinition<VolcanoMissionId>;

export const INITIAL_VOLCANO_VARIABLES: Readonly<SimulationVariables> =
  VOLCANO_SCENARIO.reset.variables;
