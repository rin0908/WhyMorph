export const SPIDER_PLANE_VARIABLE_KEYS = [
  "massKg",
  "rollingResistanceCoefficient",
  "slopeAngleDegrees",
  "targetAccelerationMetersPerSecondSquared",
  "threadDiameterMicrometers",
  "tensileStrengthMegapascals",
  "safetyFactor",
  "attachmentEfficiency",
  "threadCount",
] as const;

export type SpiderPlaneVariableKey =
  (typeof SPIDER_PLANE_VARIABLE_KEYS)[number];

export type SpiderPlaneStatus = "detached" | "snapped" | "unsafe" | "moved";
export type SpiderPlaneFailureMode =
  | "attachment_failed"
  | "thread_snapped"
  | null;

export interface SpiderPlaneVariables {
  readonly massKg: number;
  readonly rollingResistanceCoefficient: number;
  readonly slopeAngleDegrees: number;
  readonly targetAccelerationMetersPerSecondSquared: number;
  readonly threadDiameterMicrometers: number;
  readonly tensileStrengthMegapascals: number;
  readonly safetyFactor: number;
  readonly attachmentEfficiency: number;
  readonly threadCount: number;
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
  readonly allowsZero?: boolean;
  readonly integer?: boolean;
}

export interface SpiderPlaneSource {
  readonly title: string;
  readonly url: string;
  readonly use: string;
  readonly kind: "出典" | "仮定";
}

export interface SpiderPlaneResult {
  readonly status: SpiderPlaneStatus;
  readonly headline: string;
  readonly stateLabel: string;
  readonly color: string;
  readonly planeMoves: boolean;
  readonly threadBreaks: boolean;
  readonly failureMode: SpiderPlaneFailureMode;
  readonly slopeAngleRadians: number;
  readonly threadDiameterMeters: number;
  readonly tensileStrengthPascals: number;
  readonly rollingResistance: number;
  readonly slopeForce: number;
  readonly accelerationForce: number;
  readonly requiredForce: number;
  readonly threadArea: number;
  readonly singleThreadBreakingForce: number;
  readonly effectiveBreakingForcePerThread: number;
  readonly safeForcePerThread: number;
  readonly bundleBreakingForce: number;
  readonly bundleSafeForce: number;
  readonly breakingThreadCount: number | null;
  readonly requiredThreadCount: number | null;
  readonly explanation: string;
  readonly dominantCondition: string;
  readonly dominantExplanation: string;
}

export interface SpiderPlaneValidationIssue {
  readonly key: SpiderPlaneVariableKey;
  readonly message: string;
}

export interface SpiderPlaneDecisionInput {
  readonly attachmentFailed: boolean;
  readonly threadBreaks: boolean;
  readonly hasRequiredThreadCount: boolean;
  readonly hasSafeCapacity: boolean;
}

export interface SpiderPlaneDecision {
  readonly status: SpiderPlaneStatus;
  readonly planeMoves: boolean;
}

export class SpiderPlaneValidationError extends Error {
  readonly issues: readonly SpiderPlaneValidationIssue[];

  constructor(issues: readonly SpiderPlaneValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(" "));
    this.name = "SpiderPlaneValidationError";
    this.issues = issues;
  }
}

export const SPIDER_PLANE_DISCLAIMER =
  "教育用の簡略モデルです。結果は入力した仮定に依存し、実際の航空機牽引設計には使用できません。";

export const SPIDER_PLANE_SOURCES: readonly SpiderPlaneSource[] = [
  {
    title: "Boeing 737 MAX Airplane Characteristics (Rev K)",
    url: "https://www.boeing.com/content/dam/boeing/boeingdotcom/commercial/airports/acaps/737MAX_RevK.pdf",
    use: "737-8の最大設計タキシー質量82,871 kgを初期質量に使用。実際の撮影時質量ではありません。",
    kind: "出典",
  },
  {
    title: "FAA掲載 NTSB AAR-85-06",
    url: "https://www.faa.gov/sites/faa.gov/files/2022-11/AAR85-06.pdf",
    use: "乾燥路面・無制動タイヤの係数0.015〜0.02を参照し、初期値0.02を採用。737-8固有の実測値ではありません。",
    kind: "出典",
  },
  {
    title: "NIST Guide to the SI — standard gravity",
    url: "https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8",
    use: "標準重力9.80665 m/s²とSI単位を使用。",
    kind: "出典",
  },
  {
    title: "Wu et al. (2018), Nephila pilipes dragline silk",
    url: "https://pubmed.ncbi.nlm.nih.gov/30321988/",
    use: "測定範囲の直径8〜11 µm、引張強度800〜1,100 MPaを入力範囲とし、10 µm・1,000 MPaを初期値に使用。",
    kind: "出典",
  },
  {
    title: "教育用の操作仮定",
    url: "#spider-assumptions",
    use: "目標加速度0.02 m/s²、安全率3、固定効率0.5、水平・無風・エンジン停止・ブレーキ解除に加え、必要張力までゆっくり増加させる牽引試行を仮定。",
    kind: "仮定",
  },
] as const;

/**
 * 低速・一次元・準静的な教育モデル。値、式、分岐を型付きデータと純関数で
 * 固定し、AI生成コード、eval、Functionは使用しない。
 */
export const SPIDER_PLANE_SCENARIO = {
  id: "spider_thread_full_scale_airliner",
  title: "小さなクモの糸で実物の飛行機を動かせるか？",
  subject: "実物旅客機：Boeing 737-8",
  massBasis: "最大設計タキシー質量 82,871 kg（公式仕様表の上限）",
  gravityMetersPerSecondSquared: 9.80665,
  variables: {
    massKg: {
      label: "飛行機の質量",
      shortLabel: "AIRCRAFT MASS",
      min: 60_000,
      max: 82_871,
      step: 1,
      unit: "kg",
      accent: "#8bb6d9",
      description: "初期値・上限は737-8の最大設計タキシー質量。60,000 kgは教育用感度分析の下限です。",
    },
    rollingResistanceCoefficient: {
      label: "転がり抵抗係数",
      shortLabel: "ROLLING COEFFICIENT",
      min: 0.015,
      max: 0.02,
      step: 0.001,
      unit: "",
      accent: "#ff8f6b",
      description: "初期値0.02。路面、タイヤ、始動状態で変わるため、実測値ではなく資料に基づく仮定です。",
    },
    slopeAngleDegrees: {
      label: "滑走路の傾斜",
      shortLabel: "RUNWAY SLOPE",
      min: 0,
      max: 1.15,
      step: 0.05,
      unit: "°",
      accent: "#b9c8d5",
      description: "上り方向だけを扱います。1.15°は約2%勾配です。",
      allowsZero: true,
    },
    targetAccelerationMetersPerSecondSquared: {
      label: "目標加速度",
      shortLabel: "TARGET ACCELERATION",
      min: 0.001,
      max: 0.05,
      step: 0.001,
      unit: "m/s²",
      accent: "#ffb547",
      description: "初期値0.02 m/s²は教育用仮定で、航空機の運用基準ではありません。",
    },
    threadDiameterMicrometers: {
      label: "クモ糸の直径",
      shortLabel: "THREAD DIAMETER",
      min: 8,
      max: 11,
      step: 0.1,
      unit: "µm",
      accent: "#65d6ce",
      description: "Nephila pilipesのドラグライン測定範囲。1 µm = 10⁻⁶ mです。",
    },
    tensileStrengthMegapascals: {
      label: "クモ糸の引張強度",
      shortLabel: "TENSILE STRENGTH",
      min: 800,
      max: 1_100,
      step: 10,
      unit: "MPa",
      accent: "#78e0d6",
      description: "同じ研究の測定範囲。1 MPa = 10⁶ Paです。",
    },
    safetyFactor: {
      label: "安全率",
      shortLabel: "SAFETY FACTOR",
      min: 1,
      max: 10,
      step: 0.1,
      unit: "",
      accent: "#ffd18a",
      description: "初期値3は教育用仮定です。実機牽引設計の規格値ではありません。",
    },
    attachmentEfficiency: {
      label: "固定効率",
      shortLabel: "ATTACHMENT EFFICIENCY",
      min: 0,
      max: 1,
      step: 0.05,
      unit: "",
      accent: "#b1e9e4",
      description: "結び目や固定部で伝えられる割合。初期値0.5は実測値ではなく仮定です。",
      allowsZero: true,
    },
    threadCount: {
      label: "糸の本数",
      shortLabel: "THREAD COUNT",
      min: 1,
      max: 100_000_000,
      step: 1,
      unit: "本",
      accent: "#79e58c",
      description: "本数は整数です。多数本は画面上で束として表示します。",
      integer: true,
    },
  } satisfies Record<SpiderPlaneVariableKey, SpiderPlaneVariableDefinition>,
  reset: {
    massKg: 82_871,
    rollingResistanceCoefficient: 0.02,
    slopeAngleDegrees: 0,
    targetAccelerationMetersPerSecondSquared: 0.02,
    threadDiameterMicrometers: 10,
    tensileStrengthMegapascals: 1_000,
    safetyFactor: 3,
    attachmentEfficiency: 0.5,
    threadCount: 1,
  } satisfies SpiderPlaneVariables,
} as const;

export function micrometersToMeters(value: number) {
  return value * 1e-6;
}

export function megapascalsToPascals(value: number) {
  return value * 1e6;
}

export function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function validateSpiderPlaneState(
  values: SpiderPlaneVariables,
): readonly SpiderPlaneValidationIssue[] {
  const issues: SpiderPlaneValidationIssue[] = [];

  for (const key of SPIDER_PLANE_VARIABLE_KEYS) {
    const value = values[key];
    const definition = SPIDER_PLANE_SCENARIO.variables[key];

    if (!Number.isFinite(value)) {
      issues.push({ key, message: `${definition.label}は有限の数値で入力してください。` });
      continue;
    }
    const allowsZero =
      "allowsZero" in definition && definition.allowsZero === true;
    const requiresInteger =
      "integer" in definition && definition.integer === true;

    if (!allowsZero && value <= 0) {
      issues.push({ key, message: `${definition.label}は0より大きい値が必要です。` });
      continue;
    }
    if (value < definition.min || value > definition.max) {
      issues.push({
        key,
        message: `${definition.label}は${definition.min}〜${definition.max}${definition.unit}の範囲で入力してください。`,
      });
    }
    if (requiresInteger && !Number.isInteger(value)) {
      issues.push({ key, message: `${definition.label}は整数で入力してください。` });
    }
  }

  return issues;
}

function assertValidSpiderPlaneState(values: SpiderPlaneVariables) {
  const issues = validateSpiderPlaneState(values);
  if (issues.length > 0) throw new SpiderPlaneValidationError(issues);
}

export function createSpiderPlaneState(): SpiderPlaneVariables {
  return { ...SPIDER_PLANE_SCENARIO.reset };
}

export function setSpiderPlaneVariable(
  current: SpiderPlaneVariables,
  key: SpiderPlaneVariableKey,
  value: number,
): SpiderPlaneVariables {
  const candidate = { ...current, [key]: value };
  assertValidSpiderPlaneState(candidate);
  return candidate;
}

function dominantRequiredForce(
  rollingResistance: number,
  slopeForce: number,
  accelerationForce: number,
  requiredForce: number,
) {
  const contributions = [
    { label: "転がり抵抗係数", force: rollingResistance },
    { label: "滑走路の傾斜", force: slopeForce },
    { label: "目標加速度", force: accelerationForce },
  ];
  const dominant = contributions.reduce((current, candidate) =>
    candidate.force > current.force ? candidate : current,
  );
  const percentage = requiredForce > 0 ? (dominant.force / requiredForce) * 100 : 0;

  return {
    condition: dominant.label,
    explanation: `必要牽引力のうち ${percentage.toFixed(1)}%（${dominant.force.toFixed(1)} N）を占めます。これはUI範囲ではなく、現在の力の内訳から求めています。`,
  };
}

function formatForceForExplanation(value: number) {
  if (value === 0) return "0";
  if (Math.abs(value) < 0.1) return value.toFixed(5);
  if (Math.abs(value) < 100) return value.toFixed(3);
  return value.toFixed(1);
}

/**
 * 破断判定を最優先する安全ゲート。将来入力が増えて矛盾した中間状態が
 * 渡されても、破断時に機体が動く結果を返さない。
 */
export function decideSpiderPlaneMotion({
  attachmentFailed,
  threadBreaks,
  hasRequiredThreadCount,
  hasSafeCapacity,
}: SpiderPlaneDecisionInput): SpiderPlaneDecision {
  if (attachmentFailed) return { status: "detached", planeMoves: false };
  if (threadBreaks) return { status: "snapped", planeMoves: false };
  if (!hasRequiredThreadCount || !hasSafeCapacity) {
    return { status: "unsafe", planeMoves: false };
  }
  return { status: "moved", planeMoves: true };
}

export function evaluateSpiderPlane(
  values: SpiderPlaneVariables,
): SpiderPlaneResult {
  assertValidSpiderPlaneState(values);

  const gravity = SPIDER_PLANE_SCENARIO.gravityMetersPerSecondSquared;
  const slopeAngleRadians = degreesToRadians(values.slopeAngleDegrees);
  const rollingResistance =
    values.rollingResistanceCoefficient * values.massKg * gravity;
  const slopeForce =
    values.massKg * gravity * Math.sin(slopeAngleRadians);
  const accelerationForce =
    values.massKg * values.targetAccelerationMetersPerSecondSquared;
  const requiredForce =
    rollingResistance + slopeForce + accelerationForce;

  const threadDiameterMeters = micrometersToMeters(
    values.threadDiameterMicrometers,
  );
  const tensileStrengthPascals = megapascalsToPascals(
    values.tensileStrengthMegapascals,
  );
  const threadArea = Math.PI * (threadDiameterMeters / 2) ** 2;
  const singleThreadBreakingForce = tensileStrengthPascals * threadArea;
  const effectiveBreakingForcePerThread =
    singleThreadBreakingForce * values.attachmentEfficiency;
  const safeForcePerThread =
    effectiveBreakingForcePerThread / values.safetyFactor;
  const bundleBreakingForce =
    values.threadCount * effectiveBreakingForcePerThread;
  const bundleSafeForce = values.threadCount * safeForcePerThread;

  const breakingThreadCount =
    effectiveBreakingForcePerThread > 0
      ? Math.ceil(requiredForce / effectiveBreakingForcePerThread)
      : null;
  const requiredThreadCount =
    safeForcePerThread > 0
      ? Math.ceil(requiredForce / safeForcePerThread)
      : null;

  const attachmentFailed = values.attachmentEfficiency === 0;
  const threadBreaks =
    !attachmentFailed && requiredForce > bundleBreakingForce;
  const hasRequiredThreadCount =
    requiredThreadCount !== null && values.threadCount >= requiredThreadCount;
  const hasSafeCapacity = bundleSafeForce >= requiredForce;
  const decision = decideSpiderPlaneMotion({
    attachmentFailed,
    threadBreaks,
    hasRequiredThreadCount,
    hasSafeCapacity,
  });
  const { status, planeMoves } = decision;

  const outcome = {
    detached: {
      headline: "固定できていない",
      stateLabel: "力を伝えられない",
      color: "#9aa9ad",
    },
    snapped: {
      headline: "必要本数に大きく不足",
      stateLabel: "糸が先に切れる！",
      color: "#ff526d",
    },
    unsafe: {
      headline: "安全率を満たさない",
      stateLabel: "飛行機は動かさない",
      color: "#ffb547",
    },
    moved: {
      headline: "条件を満たした！",
      stateLabel: "飛行機が動く",
      color: "#79e58c",
    },
  }[status];

  const explanation = {
    detached:
      "固定効率が0のため荷重を伝えられません。固定部が外れた状態として扱い、糸は破断せず、飛行機も動きません。",
    snapped: `必要張力までゆっくり力を増やす試行で、必要牽引力 ${formatForceForExplanation(requiredForce)} N が束の有効破断力 ${formatForceForExplanation(bundleBreakingForce)} N を超えるため、糸だけが切れます。`,
    unsafe: `破断は避けられても、束の安全使用力 ${formatForceForExplanation(bundleSafeForce)} N が必要牽引力 ${formatForceForExplanation(requiredForce)} N に届きません。安全率を満たさないため動かしません。`,
    moved: `束の安全使用力 ${formatForceForExplanation(bundleSafeForce)} N が必要牽引力 ${formatForceForExplanation(requiredForce)} N 以上で、破断もしないため、この簡略モデルでは動く条件が成立します。`,
  }[status];

  const dominant = dominantRequiredForce(
    rollingResistance,
    slopeForce,
    accelerationForce,
    requiredForce,
  );

  return {
    status,
    headline: outcome.headline,
    stateLabel: outcome.stateLabel,
    color: outcome.color,
    planeMoves,
    threadBreaks,
    failureMode: attachmentFailed
      ? "attachment_failed"
      : threadBreaks
        ? "thread_snapped"
        : null,
    slopeAngleRadians,
    threadDiameterMeters,
    tensileStrengthPascals,
    rollingResistance,
    slopeForce,
    accelerationForce,
    requiredForce,
    threadArea,
    singleThreadBreakingForce,
    effectiveBreakingForcePerThread,
    safeForcePerThread,
    bundleBreakingForce,
    bundleSafeForce,
    breakingThreadCount,
    requiredThreadCount,
    explanation,
    dominantCondition: dominant.condition,
    dominantExplanation: dominant.explanation,
  };
}
