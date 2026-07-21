export const SPIDER_PLANE_VARIABLE_KEYS = [
  "threadCount",
  "threadStrength",
  "pullForce",
  "planeMass",
  "friction",
] as const;

export type SpiderPlaneVariableKey =
  (typeof SPIDER_PLANE_VARIABLE_KEYS)[number];

export type SpiderPlaneStatus = "still" | "small" | "moved" | "snapped";

export interface SpiderPlaneVariables {
  readonly threadCount: number;
  readonly threadStrength: number;
  readonly pullForce: number;
  readonly planeMass: number;
  readonly friction: number;
}

interface SpiderPlaneVariableDefinition {
  readonly label: string;
  readonly shortLabel: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit: string;
  readonly accent: string;
  readonly description: string;
}

interface SpiderPlaneOutcomeDefinition {
  readonly headline: string;
  readonly eyebrow: string;
  readonly color: string;
}

type SpiderPlaneRuleMetric =
  | "pullForce"
  | "threadStrength"
  | "totalPull"
  | "frictionForce"
  | "distanceMeters"
  | "largeMoveMeters";

type SpiderPlaneRuleDefinition =
  | {
      readonly status: Exclude<SpiderPlaneStatus, "moved">;
      readonly left: SpiderPlaneRuleMetric;
      readonly operator: "gt" | "lte" | "lt";
      readonly right: SpiderPlaneRuleMetric;
    }
  | {
      readonly status: "moved";
      readonly operator: "always";
    };

export interface SpiderPlaneResult {
  readonly status: SpiderPlaneStatus;
  readonly headline: string;
  readonly eyebrow: string;
  readonly color: string;
  readonly totalPull: number;
  readonly totalStrength: number;
  readonly frictionForce: number;
  readonly netForce: number;
  readonly distanceMeters: number;
  readonly movementPercent: number;
  readonly requiredThreadCount: number | null;
  readonly explanation: string;
  readonly dominantCondition: string;
  readonly dominantExplanation: string;
}

/**
 * 教育用の簡略モデル。ルールと許容範囲をデータとして固定し、文字列や
 * AI生成コードは実行しない。
 */
export const SPIDER_PLANE_SCENARIO = {
  id: "spider_thread_plane",
  title: "小さなクモの糸で飛行機を動かせるか？",
  location: "格納庫の実験レーン",
  observationSeconds: 3,
  gravity: 9.8,
  largeMoveMeters: 0.75,
  variables: {
    threadCount: {
      label: "糸の本数",
      shortLabel: "THREADS",
      min: 1,
      max: 60,
      step: 1,
      unit: "本",
      accent: "#65d6ce",
      description: "同じ強さで引くクモの糸を何本束ねるか。",
    },
    threadStrength: {
      label: "糸1本あたりの強さ",
      shortLabel: "STRENGTH / THREAD",
      min: 1,
      max: 25,
      step: 1,
      unit: "N",
      accent: "#a8e4de",
      description: "糸1本が切れずに耐えられる力。",
    },
    pullForce: {
      label: "引く力",
      shortLabel: "PULL / THREAD",
      min: 0,
      max: 30,
      step: 1,
      unit: "N/本",
      accent: "#ffb547",
      description: "糸1本ずつにかける力。本数を増やすと合計の力も増えます。",
    },
    planeMass: {
      label: "飛行機の質量",
      shortLabel: "MODEL MASS",
      min: 50,
      max: 500,
      step: 10,
      unit: "kg",
      accent: "#8bb6d9",
      description: "この実験で使う飛行機モデルの重さ。",
    },
    friction: {
      label: "地面との摩擦",
      shortLabel: "GROUND FRICTION",
      min: 1,
      max: 10,
      step: 1,
      unit: "%",
      accent: "#ff8f6b",
      description: "タイヤと地面が動きを止めようとする割合。",
    },
  } satisfies Record<SpiderPlaneVariableKey, SpiderPlaneVariableDefinition>,
  reset: {
    threadCount: 1,
    threadStrength: 12,
    pullForce: 5,
    planeMass: 200,
    friction: 2,
  } satisfies SpiderPlaneVariables,
  rules: [
    {
      status: "snapped",
      left: "pullForce",
      operator: "gt",
      right: "threadStrength",
    },
    {
      status: "still",
      left: "totalPull",
      operator: "lte",
      right: "frictionForce",
    },
    {
      status: "small",
      left: "distanceMeters",
      operator: "lt",
      right: "largeMoveMeters",
    },
    { status: "moved", operator: "always" },
  ] satisfies readonly SpiderPlaneRuleDefinition[],
  outcomes: {
    still: {
      headline: "動かない",
      eyebrow: "力が足りない",
      color: "#65d6ce",
    },
    small: {
      headline: "少し動く",
      eyebrow: "摩擦を少し超えた",
      color: "#ffb547",
    },
    moved: {
      headline: "動いた！",
      eyebrow: "力が摩擦を超えた",
      color: "#79e58c",
    },
    snapped: {
      headline: "糸が切れた！",
      eyebrow: "耐久限界を超えた",
      color: "#ff526d",
    },
  } satisfies Record<SpiderPlaneStatus, SpiderPlaneOutcomeDefinition>,
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeValue(key: SpiderPlaneVariableKey, value: number) {
  const definition = SPIDER_PLANE_SCENARIO.variables[key];
  const fallback = SPIDER_PLANE_SCENARIO.reset[key];
  const finiteValue = Number.isFinite(value) ? value : fallback;
  const stepped =
    definition.min +
    Math.round((finiteValue - definition.min) / definition.step) *
      definition.step;
  const bounded = clamp(stepped, definition.min, definition.max);
  return key === "threadCount" ? Math.round(bounded) : bounded;
}

export function createSpiderPlaneState(): SpiderPlaneVariables {
  return { ...SPIDER_PLANE_SCENARIO.reset };
}

export function setSpiderPlaneVariable(
  current: SpiderPlaneVariables,
  key: SpiderPlaneVariableKey,
  value: number,
): SpiderPlaneVariables {
  return {
    ...current,
    [key]: normalizeValue(key, value),
  };
}

export function sanitizeSpiderPlaneState(
  values: SpiderPlaneVariables,
): SpiderPlaneVariables {
  return {
    threadCount: normalizeValue("threadCount", values.threadCount),
    threadStrength: normalizeValue("threadStrength", values.threadStrength),
    pullForce: normalizeValue("pullForce", values.pullForce),
    planeMass: normalizeValue("planeMass", values.planeMass),
    friction: normalizeValue("friction", values.friction),
  };
}

function movementPercent(status: SpiderPlaneStatus, distanceMeters: number) {
  if (status === "still" || status === "snapped") return 0;
  if (status === "small") {
    return clamp(
      (distanceMeters / SPIDER_PLANE_SCENARIO.largeMoveMeters) * 34,
      5,
      34,
    );
  }
  return clamp(
    45 +
      (distanceMeters - SPIDER_PLANE_SCENARIO.largeMoveMeters) * 12,
    45,
    78,
  );
}

function matchesSpiderPlaneRule(
  rule: SpiderPlaneRuleDefinition,
  metrics: Readonly<Record<SpiderPlaneRuleMetric, number>>,
) {
  if (rule.operator === "always") return true;
  const left = metrics[rule.left];
  const right = metrics[rule.right];
  switch (rule.operator) {
    case "gt":
      return left > right;
    case "lte":
      return left <= right;
    case "lt":
      return left < right;
  }
}

function dominantInfluence(
  values: SpiderPlaneVariables,
  status: SpiderPlaneStatus,
  requiredThreadCount: number | null,
) {
  const definitions = SPIDER_PLANE_SCENARIO.variables;

  if (status === "snapped") {
    const pullSeverity =
      (values.pullForce - definitions.pullForce.min) /
      (definitions.pullForce.max - definitions.pullForce.min);
    const weaknessSeverity =
      (definitions.threadStrength.max - values.threadStrength) /
      (definitions.threadStrength.max - definitions.threadStrength.min);
    return pullSeverity >= weaknessSeverity
      ? {
          condition: "引く力",
          explanation: "1本にかける力が高く、糸の耐久限界を超えています。",
        }
      : {
          condition: "糸1本あたりの強さ",
          explanation: "現在の糸が弱く、1本にかかる力へ耐えられません。",
        };
  }

  if (values.pullForce <= 0) {
    return {
      condition: "引く力",
      explanation: "引く力が0なので、本数を増やしても合計引力は増えません。",
    };
  }

  const tenPercent = 0.1;
  const influences = [
    {
      key: "threadCount" as const,
      amount:
        values.pullForce *
        (definitions.threadCount.max - definitions.threadCount.min) *
        tenPercent,
    },
    {
      key: "pullForce" as const,
      amount:
        values.threadCount *
        (definitions.pullForce.max - definitions.pullForce.min) *
        tenPercent,
    },
    {
      key: "planeMass" as const,
      amount:
        SPIDER_PLANE_SCENARIO.gravity *
        (values.friction / 100) *
        (definitions.planeMass.max - definitions.planeMass.min) *
        tenPercent,
    },
    {
      key: "friction" as const,
      amount:
        (values.planeMass * SPIDER_PLANE_SCENARIO.gravity) /
        100 *
        (definitions.friction.max - definitions.friction.min) *
        tenPercent,
    },
  ];
  const strongest = influences.reduce((current, candidate) =>
    candidate.amount > current.amount ? candidate : current,
  );

  switch (strongest.key) {
    case "threadCount":
      return {
        condition: "糸の本数",
        explanation:
          status === "still" && requiredThreadCount !== null
            ? `今の力では少なくとも ${requiredThreadCount}本が必要で、本数の変化が合計引力へ最も強く影響します。`
            : "現在の引く力では、本数の変化が合計引力へ最も強く影響します。",
      };
    case "pullForce":
      return {
        condition: "引く力",
        explanation:
          "現在の本数では、1本にかける力の変化が合計引力へ最も強く影響します。",
      };
    case "planeMass":
      return {
        condition: "飛行機の質量",
        explanation: "現在の摩擦率では、質量の変化が地面の抵抗へ最も強く影響します。",
      };
    case "friction":
      return {
        condition: "地面との摩擦",
        explanation: "現在の質量では、摩擦率の変化が地面の抵抗へ最も強く影響します。",
      };
  }
}

export function evaluateSpiderPlane(
  rawValues: SpiderPlaneVariables,
): SpiderPlaneResult {
  const values = sanitizeSpiderPlaneState(rawValues);
  const totalPull = values.threadCount * values.pullForce;
  const totalStrength = values.threadCount * values.threadStrength;
  const frictionForce =
    values.planeMass *
    SPIDER_PLANE_SCENARIO.gravity *
    (values.friction / 100);
  const candidateNetForce = Math.max(0, totalPull - frictionForce);
  const candidateDistanceMeters =
    0.5 *
    (candidateNetForce / values.planeMass) *
    SPIDER_PLANE_SCENARIO.observationSeconds ** 2;
  const metrics: Readonly<Record<SpiderPlaneRuleMetric, number>> = {
    pullForce: values.pullForce,
    threadStrength: values.threadStrength,
    totalPull,
    frictionForce,
    distanceMeters: candidateDistanceMeters,
    largeMoveMeters: SPIDER_PLANE_SCENARIO.largeMoveMeters,
  };
  const matchedRule = SPIDER_PLANE_SCENARIO.rules.find((rule) =>
    matchesSpiderPlaneRule(rule, metrics),
  );
  if (!matchedRule) {
    throw new Error("クモ糸シミュレーションの状態を判定できませんでした。");
  }
  const status = matchedRule.status;
  const snapped = status === "snapped";
  const netForce = snapped ? 0 : candidateNetForce;
  const distanceMeters = snapped ? 0 : candidateDistanceMeters;

  const requiredThreadCount =
    values.pullForce <= 0 || snapped
      ? null
      : Math.floor(frictionForce / values.pullForce) + 1;
  const outcome = SPIDER_PLANE_SCENARIO.outcomes[status];

  const explanation = {
    still: `合計の引く力 ${totalPull.toFixed(1)}N が、摩擦力 ${frictionForce.toFixed(1)}N に届いていません。`,
    small: `合計の引く力が摩擦をわずかに上回り、3秒で ${distanceMeters.toFixed(2)}m 動きました。`,
    moved: `合計の引く力が摩擦を大きく上回り、3秒で ${distanceMeters.toFixed(2)}m 動きました。`,
    snapped: `1本あたり ${values.pullForce.toFixed(1)}N で引き、糸の強さ ${values.threadStrength.toFixed(1)}N を超えました。`,
  }[status];

  const dominant = dominantInfluence(
    values,
    status,
    requiredThreadCount,
  );

  return {
    status,
    headline: outcome.headline,
    eyebrow: outcome.eyebrow,
    color: outcome.color,
    totalPull,
    totalStrength,
    frictionForce,
    netForce,
    distanceMeters,
    movementPercent: movementPercent(status, distanceMeters),
    requiredThreadCount,
    explanation,
    dominantCondition: dominant.condition,
    dominantExplanation: dominant.explanation,
  };
}
