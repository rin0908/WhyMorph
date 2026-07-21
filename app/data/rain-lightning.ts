export const RAIN_LIGHTNING_INPUT_KEYS = [
  "waterVapor",
  "instability",
  "updraft",
] as const;

export type RainLightningInputKey =
  (typeof RAIN_LIGHTNING_INPUT_KEYS)[number];

export interface RainLightningInputs {
  readonly waterVapor: number;
  readonly instability: number;
  readonly updraft: number;
}

export interface RainLightningDerived {
  readonly condensationEase: number;
  readonly cloudDevelopment: number;
  readonly particleGrowth: number;
  readonly precipitationIntensity: number;
  readonly icePhaseDevelopment: number;
  readonly chargeSeparation: number;
  readonly lightningPotential: number;
}

export type RainLightningStateId =
  | "sunny"
  | "cloud_forming"
  | "cloud_developing"
  | "rain"
  | "heavy_rain"
  | "thundercloud"
  | "lightning";

export interface RainLightningFlags {
  readonly cloudVisible: boolean;
  readonly cloudDeveloping: boolean;
  readonly raining: boolean;
  readonly heavyRain: boolean;
  readonly thundercloud: boolean;
  readonly lightning: boolean;
}

export interface RainLightningMissingCondition {
  readonly label: string;
  readonly current: number;
  readonly threshold: number;
  readonly unit: "相対値";
}

export interface RainLightningEvaluation {
  readonly inputs: RainLightningInputs;
  readonly derived: RainLightningDerived;
  readonly flags: RainLightningFlags;
  readonly state: RainLightningStateId;
  readonly stateLabel: string;
  readonly explanation: string;
  readonly missingConditions: readonly RainLightningMissingCondition[];
  readonly nextDiscovery: string;
  readonly rainDropCount: number;
  readonly rainSpeed: "stopped" | "gentle" | "fast";
}

interface RainLightningInputDefinition {
  readonly label: string;
  readonly shortLabel: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit: string;
  readonly accent: string;
  readonly description: string;
}

interface RainLightningDerivedDefinition {
  readonly key: keyof RainLightningDerived;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
}

export const RAIN_LIGHTNING_DEFAULTS = {
  waterVapor: 20,
  instability: 20,
  updraft: 15,
} as const satisfies RainLightningInputs;

export const RAIN_LIGHTNING_INPUTS = {
  waterVapor: {
    label: "空気中の水蒸気量",
    shortLabel: "WATER VAPOR",
    min: 0,
    max: 100,
    step: 1,
    unit: "",
    accent: "#70d6ff",
    description: "雲粒や雨粒の材料になる水蒸気の相対的な多さです。",
  },
  instability: {
    label: "大気の不安定さ",
    shortLabel: "INSTABILITY",
    min: 0,
    max: 100,
    step: 1,
    unit: "",
    accent: "#ffb86b",
    description: "空気が上へ動き続け、雲が縦に発達しやすい度合いです。",
  },
  updraft: {
    label: "上昇気流の強さ",
    shortLabel: "UPDRAFT",
    min: 0,
    max: 100,
    step: 1,
    unit: "",
    accent: "#91e6c4",
    description: "湿った空気や雲粒を上へ運ぶ流れの相対的な強さです。",
  },
} as const satisfies Record<
  RainLightningInputKey,
  RainLightningInputDefinition
>;

export const RAIN_LIGHTNING_DERIVED = [
  {
    key: "condensationEase",
    label: "凝結しやすさ",
    shortLabel: "CONDENSATION",
    description: "水蒸気と、上昇による冷却の組み合わせ",
  },
  {
    key: "cloudDevelopment",
    label: "雲の発達度",
    shortLabel: "CLOUD GROWTH",
    description: "凝結した粒が上昇気流に支えられる度合い",
  },
  {
    key: "particleGrowth",
    label: "雨滴・氷晶の成長度",
    shortLabel: "PARTICLE GROWTH",
    description: "雲の中の粒が成長して落下に近づく度合い",
  },
  {
    key: "precipitationIntensity",
    label: "降水強度",
    shortLabel: "PRECIPITATION",
    description: "成長した粒が雨として落ちる相対的な強さ",
  },
  {
    key: "icePhaseDevelopment",
    label: "氷相発達度",
    shortLabel: "ICE PHASE",
    description: "雲の冷たい領域で氷晶などが発達する度合い",
  },
  {
    key: "chargeSeparation",
    label: "電荷分離度",
    shortLabel: "CHARGE SEPARATION",
    description: "氷晶などの衝突で正負の電荷が分かれる度合い",
  },
  {
    key: "lightningPotential",
    label: "雷発生可能性",
    shortLabel: "LIGHTNING POTENTIAL",
    description: "放電条件への近さを示す教育用の相対指標",
  },
] as const satisfies readonly RainLightningDerivedDefinition[];

/**
 * 予報値・観測基準ではなく、0〜100の教育用相対指標を状態へ分ける目安。
 * すべて名前付き定数に固定し、UI側に判断ロジックを分散させない。
 */
export const RAIN_LIGHTNING_THRESHOLDS = {
  EXPLANATION_HIGH_INPUT_MIN: 70,
  EXPLANATION_LOW_INPUT_MAX: 35,

  ICE_PHASE_INSTABILITY_ONSET: 30,
  ICE_PHASE_UPDRAFT_ONSET: 35,
  CHARGE_SEPARATION_UPDRAFT_ONSET: 45,

  CLOUD_FORMING_CONDENSATION_MIN: 8,
  CLOUD_FORMING_DEVELOPMENT_MIN: 6,

  CLOUD_DEVELOPING_CONDENSATION_MIN: 25,
  CLOUD_DEVELOPING_DEVELOPMENT_MIN: 30,
  CLOUD_SUPPORT_INSTABILITY_MIN: 35,
  CLOUD_SUPPORT_UPDRAFT_MIN: 45,

  RAIN_CLOUD_MIN: 35,
  RAIN_PARTICLE_GROWTH_MIN: 28,
  RAIN_PRECIPITATION_MIN: 20,

  HEAVY_RAIN_CLOUD_MIN: 55,
  HEAVY_RAIN_PARTICLE_GROWTH_MIN: 60,
  HEAVY_RAIN_PRECIPITATION_MIN: 55,

  THUNDERCLOUD_CLOUD_MIN: 60,
  THUNDERCLOUD_ICE_PHASE_MIN: 45,
  THUNDERCLOUD_CHARGE_MIN: 30,
  THUNDERCLOUD_INSTABILITY_MIN: 70,
  THUNDERCLOUD_UPDRAFT_MIN: 70,

  LIGHTNING_CLOUD_MIN: 70,
  LIGHTNING_ICE_PHASE_MIN: 65,
  LIGHTNING_CHARGE_MIN: 55,
  LIGHTNING_POTENTIAL_MIN: 50,
  LIGHTNING_INSTABILITY_MIN: 85,
  LIGHTNING_UPDRAFT_MIN: 85,
} as const;

export const RAIN_LIGHTNING_WEIGHTS = {
  condensation: { updraft: 0.65, instability: 0.35 },
  cloudDevelopment: { base: 0.45, instability: 0.3, updraft: 0.25 },
  particleGrowth: { waterVapor: 0.5, updraft: 0.3, instability: 0.2 },
  precipitation: { cloudDevelopment: 0.55, waterVapor: 0.25, updraft: 0.2 },
  chargeCollision: { instability: 0.55, cloudDevelopment: 0.45 },
  lightningPotential: { icePhase: 0.55, updraft: 0.25, instability: 0.2 },
} as const;

export const RAIN_LIGHTNING_DISCLAIMERS = [
  "これは教育用の簡略モデルです。実際の雨や雷には、気圧、風、地形、雲粒や氷晶の成長など、さらに多くの条件が関係します。本モデルの数値は相対指標であり、天気予報には使用できません。",
  "雷の詳しい帯電過程には、現在も研究されている部分があります。",
] as const;

const STATE_LABELS: Record<RainLightningStateId, string> = {
  sunny: "晴れ",
  cloud_forming: "雲ができ始める",
  cloud_developing: "雲が発達する",
  rain: "雨",
  heavy_rain: "強い雨",
  thundercloud: "雷雲",
  lightning: "雷発生",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function finiteInput(value: number, name: RainLightningInputKey) {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name}は有限の数値で入力してください。`);
  }
  return clamp(value, 0, 100);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function positiveRamp(value: number, onset: number) {
  return clamp((value - onset) / (100 - onset), 0, 1);
}

export function normalizeRainLightningInputs(
  input: Readonly<RainLightningInputs>,
): RainLightningInputs {
  return {
    waterVapor: finiteInput(input.waterVapor, "waterVapor"),
    instability: finiteInput(input.instability, "instability"),
    updraft: finiteInput(input.updraft, "updraft"),
  };
}

export function createRainLightningInputs(): RainLightningInputs {
  return { ...RAIN_LIGHTNING_DEFAULTS };
}

export function setRainLightningInput(
  current: Readonly<RainLightningInputs>,
  key: RainLightningInputKey,
  value: number,
): RainLightningInputs {
  return normalizeRainLightningInputs({ ...current, [key]: value });
}

export function deriveRainLightning(
  input: Readonly<RainLightningInputs>,
): RainLightningDerived {
  const normalized = normalizeRainLightningInputs(input);
  const waterVapor = normalized.waterVapor / 100;
  const instability = normalized.instability / 100;
  const updraft = normalized.updraft / 100;

  // 水蒸気だけでは成立しない。上昇気流と不安定さを上昇冷却の代理にする。
  const condensation =
    waterVapor *
    (RAIN_LIGHTNING_WEIGHTS.condensation.updraft * updraft +
      RAIN_LIGHTNING_WEIGHTS.condensation.instability * instability);

  const cloud =
    condensation *
    (RAIN_LIGHTNING_WEIGHTS.cloudDevelopment.base +
      RAIN_LIGHTNING_WEIGHTS.cloudDevelopment.instability * instability +
      RAIN_LIGHTNING_WEIGHTS.cloudDevelopment.updraft * updraft);

  const particle =
    cloud *
    (RAIN_LIGHTNING_WEIGHTS.particleGrowth.waterVapor * waterVapor +
      RAIN_LIGHTNING_WEIGHTS.particleGrowth.updraft * updraft +
      RAIN_LIGHTNING_WEIGHTS.particleGrowth.instability * instability);

  const precipitation =
    particle *
    (RAIN_LIGHTNING_WEIGHTS.precipitation.cloudDevelopment * cloud +
      RAIN_LIGHTNING_WEIGHTS.precipitation.waterVapor * waterVapor +
      RAIN_LIGHTNING_WEIGHTS.precipitation.updraft * updraft);

  // 氷相は発達した雲が冷たい上層まで届いたことを表す代理指標。
  const ice =
    cloud *
    positiveRamp(
      normalized.instability,
      RAIN_LIGHTNING_THRESHOLDS.ICE_PHASE_INSTABILITY_ONSET,
    ) *
    positiveRamp(
      normalized.updraft,
      RAIN_LIGHTNING_THRESHOLDS.ICE_PHASE_UPDRAFT_ONSET,
    );

  // 電荷分離は氷相・衝突・強い上昇流が同時にある場合だけ進む。
  const charge =
    ice *
    positiveRamp(
      normalized.updraft,
      RAIN_LIGHTNING_THRESHOLDS.CHARGE_SEPARATION_UPDRAFT_ONSET,
    ) *
    (RAIN_LIGHTNING_WEIGHTS.chargeCollision.instability * instability +
      RAIN_LIGHTNING_WEIGHTS.chargeCollision.cloudDevelopment * cloud);

  const lightning =
    charge *
    (RAIN_LIGHTNING_WEIGHTS.lightningPotential.icePhase * ice +
      RAIN_LIGHTNING_WEIGHTS.lightningPotential.updraft * updraft +
      RAIN_LIGHTNING_WEIGHTS.lightningPotential.instability * instability);

  return {
    condensationEase: round1(clamp(condensation * 100, 0, 100)),
    cloudDevelopment: round1(clamp(cloud * 100, 0, 100)),
    particleGrowth: round1(clamp(particle * 100, 0, 100)),
    precipitationIntensity: round1(clamp(precipitation * 100, 0, 100)),
    icePhaseDevelopment: round1(clamp(ice * 100, 0, 100)),
    chargeSeparation: round1(clamp(charge * 100, 0, 100)),
    lightningPotential: round1(clamp(lightning * 100, 0, 100)),
  };
}

export function evaluateRainLightningFlags(
  input: Readonly<RainLightningInputs>,
  derived: Readonly<RainLightningDerived>,
): RainLightningFlags {
  const normalized = normalizeRainLightningInputs(input);
  const threshold = RAIN_LIGHTNING_THRESHOLDS;

  const cloudVisible =
    derived.condensationEase >= threshold.CLOUD_FORMING_CONDENSATION_MIN &&
    derived.cloudDevelopment >= threshold.CLOUD_FORMING_DEVELOPMENT_MIN;

  const cloudDeveloping =
    derived.condensationEase >=
      threshold.CLOUD_DEVELOPING_CONDENSATION_MIN &&
    derived.cloudDevelopment >=
      threshold.CLOUD_DEVELOPING_DEVELOPMENT_MIN &&
    (normalized.instability >= threshold.CLOUD_SUPPORT_INSTABILITY_MIN ||
      normalized.updraft >= threshold.CLOUD_SUPPORT_UPDRAFT_MIN);

  const raining =
    derived.cloudDevelopment >= threshold.RAIN_CLOUD_MIN &&
    derived.particleGrowth >= threshold.RAIN_PARTICLE_GROWTH_MIN &&
    derived.precipitationIntensity >= threshold.RAIN_PRECIPITATION_MIN;

  const heavyRain =
    derived.cloudDevelopment >= threshold.HEAVY_RAIN_CLOUD_MIN &&
    derived.particleGrowth >=
      threshold.HEAVY_RAIN_PARTICLE_GROWTH_MIN &&
    derived.precipitationIntensity >=
      threshold.HEAVY_RAIN_PRECIPITATION_MIN;

  const thundercloud =
    derived.cloudDevelopment >= threshold.THUNDERCLOUD_CLOUD_MIN &&
    derived.icePhaseDevelopment >= threshold.THUNDERCLOUD_ICE_PHASE_MIN &&
    derived.chargeSeparation >= threshold.THUNDERCLOUD_CHARGE_MIN &&
    normalized.instability >= threshold.THUNDERCLOUD_INSTABILITY_MIN &&
    normalized.updraft >= threshold.THUNDERCLOUD_UPDRAFT_MIN;

  const lightning =
    derived.cloudDevelopment >= threshold.LIGHTNING_CLOUD_MIN &&
    derived.icePhaseDevelopment >= threshold.LIGHTNING_ICE_PHASE_MIN &&
    derived.chargeSeparation >= threshold.LIGHTNING_CHARGE_MIN &&
    derived.lightningPotential >= threshold.LIGHTNING_POTENTIAL_MIN &&
    normalized.instability >= threshold.LIGHTNING_INSTABILITY_MIN &&
    normalized.updraft >= threshold.LIGHTNING_UPDRAFT_MIN;

  return {
    cloudVisible,
    cloudDeveloping,
    raining,
    heavyRain,
    thundercloud,
    lightning,
  };
}

export function selectRainLightningState(
  flags: Readonly<RainLightningFlags>,
): RainLightningStateId {
  if (flags.lightning) return "lightning";
  if (flags.thundercloud) return "thundercloud";
  if (flags.heavyRain) return "heavy_rain";
  if (flags.raining) return "rain";
  if (flags.cloudDeveloping) return "cloud_developing";
  if (flags.cloudVisible) return "cloud_forming";
  return "sunny";
}

function condition(
  label: string,
  current: number,
  threshold: number,
): RainLightningMissingCondition | null {
  if (current >= threshold) return null;
  return { label, current, threshold, unit: "相対値" };
}

function compactConditions(
  candidates: readonly (RainLightningMissingCondition | null)[],
) {
  return candidates.filter(
    (candidate): candidate is RainLightningMissingCondition =>
      candidate !== null,
  );
}

function cloudSupportCondition(
  inputs: RainLightningInputs,
): RainLightningMissingCondition | null {
  const threshold = RAIN_LIGHTNING_THRESHOLDS;
  if (
    inputs.instability >= threshold.CLOUD_SUPPORT_INSTABILITY_MIN ||
    inputs.updraft >= threshold.CLOUD_SUPPORT_UPDRAFT_MIN
  ) {
    return null;
  }

  const instabilityProgress =
    inputs.instability / threshold.CLOUD_SUPPORT_INSTABILITY_MIN;
  const updraftProgress = inputs.updraft / threshold.CLOUD_SUPPORT_UPDRAFT_MIN;

  if (instabilityProgress >= updraftProgress) {
    return condition(
      `大気の不安定さ（または上昇気流${threshold.CLOUD_SUPPORT_UPDRAFT_MIN}以上）`,
      inputs.instability,
      threshold.CLOUD_SUPPORT_INSTABILITY_MIN,
    );
  }

  return condition(
    `上昇気流（または不安定さ${threshold.CLOUD_SUPPORT_INSTABILITY_MIN}以上）`,
    inputs.updraft,
    threshold.CLOUD_SUPPORT_UPDRAFT_MIN,
  );
}

function thundercloudMissingConditions(
  inputs: RainLightningInputs,
  derived: RainLightningDerived,
) {
  const threshold = RAIN_LIGHTNING_THRESHOLDS;
  return compactConditions([
    condition(
      "雷雲に必要な雲の発達度",
      derived.cloudDevelopment,
      threshold.THUNDERCLOUD_CLOUD_MIN,
    ),
    condition(
      "雷雲に必要な氷相発達度",
      derived.icePhaseDevelopment,
      threshold.THUNDERCLOUD_ICE_PHASE_MIN,
    ),
    condition(
      "雷雲に必要な電荷分離度",
      derived.chargeSeparation,
      threshold.THUNDERCLOUD_CHARGE_MIN,
    ),
    condition(
      "雷雲に必要な大気の不安定さ",
      inputs.instability,
      threshold.THUNDERCLOUD_INSTABILITY_MIN,
    ),
    condition(
      "雷雲に必要な上昇気流の強さ",
      inputs.updraft,
      threshold.THUNDERCLOUD_UPDRAFT_MIN,
    ),
  ]);
}

function missingConditionsFor(
  state: RainLightningStateId,
  inputs: RainLightningInputs,
  derived: RainLightningDerived,
) {
  const threshold = RAIN_LIGHTNING_THRESHOLDS;

  if (state === "sunny") {
    return compactConditions([
      condition(
        "凝結しやすさ",
        derived.condensationEase,
        threshold.CLOUD_FORMING_CONDENSATION_MIN,
      ),
      condition(
        "雲の発達度",
        derived.cloudDevelopment,
        threshold.CLOUD_FORMING_DEVELOPMENT_MIN,
      ),
    ]);
  }

  if (state === "cloud_forming") {
    return compactConditions([
      condition(
        "凝結しやすさ",
        derived.condensationEase,
        threshold.CLOUD_DEVELOPING_CONDENSATION_MIN,
      ),
      condition(
        "雲の発達度",
        derived.cloudDevelopment,
        threshold.CLOUD_DEVELOPING_DEVELOPMENT_MIN,
      ),
      cloudSupportCondition(inputs),
    ]);
  }

  if (state === "cloud_developing") {
    return compactConditions([
      condition(
        "雲の発達度",
        derived.cloudDevelopment,
        threshold.RAIN_CLOUD_MIN,
      ),
      condition(
        "雨滴・氷晶の成長度",
        derived.particleGrowth,
        threshold.RAIN_PARTICLE_GROWTH_MIN,
      ),
      condition(
        "降水強度",
        derived.precipitationIntensity,
        threshold.RAIN_PRECIPITATION_MIN,
      ),
    ]);
  }

  if (state === "rain") {
    return compactConditions([
      condition(
        "強い雨に必要な雲の発達度",
        derived.cloudDevelopment,
        threshold.HEAVY_RAIN_CLOUD_MIN,
      ),
      condition(
        "強い雨に必要な粒の成長度",
        derived.particleGrowth,
        threshold.HEAVY_RAIN_PARTICLE_GROWTH_MIN,
      ),
      condition(
        "強い雨に必要な降水強度",
        derived.precipitationIntensity,
        threshold.HEAVY_RAIN_PRECIPITATION_MIN,
      ),
      ...thundercloudMissingConditions(inputs, derived),
    ]);
  }

  if (state === "heavy_rain") {
    return thundercloudMissingConditions(inputs, derived);
  }

  if (state === "thundercloud") {
    return compactConditions([
      condition(
        "放電に必要な雲の発達度",
        derived.cloudDevelopment,
        threshold.LIGHTNING_CLOUD_MIN,
      ),
      condition(
        "放電に必要な氷相発達度",
        derived.icePhaseDevelopment,
        threshold.LIGHTNING_ICE_PHASE_MIN,
      ),
      condition(
        "放電に必要な電荷分離度",
        derived.chargeSeparation,
        threshold.LIGHTNING_CHARGE_MIN,
      ),
      condition(
        "雷発生可能性",
        derived.lightningPotential,
        threshold.LIGHTNING_POTENTIAL_MIN,
      ),
      condition(
        "放電に必要な大気の不安定さ",
        inputs.instability,
        threshold.LIGHTNING_INSTABILITY_MIN,
      ),
      condition(
        "放電に必要な上昇気流",
        inputs.updraft,
        threshold.LIGHTNING_UPDRAFT_MIN,
      ),
    ]);
  }

  return [];
}

function summarizeMissingConditions(
  conditions: readonly RainLightningMissingCondition[],
) {
  const labels = conditions.map((item) =>
    item.label.replace(/^雷雲に必要な/u, ""),
  );
  if (labels.length <= 3) return labels.join("・");
  return `${labels.slice(0, 3).join("・")}など`;
}

function explanationFor(
  state: RainLightningStateId,
  inputs: RainLightningInputs,
  derived: RainLightningDerived,
) {
  const threshold = RAIN_LIGHTNING_THRESHOLDS;
  if (
    state === "sunny" &&
    inputs.waterVapor >= threshold.EXPLANATION_HIGH_INPUT_MIN &&
    inputs.updraft < threshold.EXPLANATION_LOW_INPUT_MAX
  ) {
    return "水蒸気は十分ですが、上昇気流が弱く上昇による冷却が足りないため、雲が発達していません。";
  }
  if (
    state === "sunny" &&
    inputs.updraft >= threshold.EXPLANATION_HIGH_INPUT_MIN &&
    inputs.waterVapor < threshold.EXPLANATION_LOW_INPUT_MAX
  ) {
    return "上昇気流は強いですが、雲粒の材料になる水蒸気が少ないため、雲が発達していません。";
  }

  if (state === "cloud_developing") {
    const missing = missingConditionsFor(state, inputs, derived);
    return `凝結が続き、上昇気流に支えられて雲が厚くなりました。雨になるには、${summarizeMissingConditions(missing)}がまだ不足しています。`;
  }

  if (state === "rain" || state === "heavy_rain") {
    const missing = thundercloudMissingConditions(inputs, derived);
    const prefix =
      state === "heavy_rain"
        ? "粒の成長と降水強度が高まり、雨が強くなりました。強い雨だけでは雷は起こりません。"
        : "雲粒や氷晶が成長し、落下できる状態になったため雨が降っています。";
    return `${prefix}ただし、${summarizeMissingConditions(missing)}が不足しているため雷雲にはなりません。`;
  }

  return {
    sunny:
      "水蒸気と上昇による冷却の組み合わせがまだ弱く、雲粒が十分にできていません。",
    cloud_forming:
      "湿った空気が上昇して冷え、水蒸気の凝結が始まりました。粒がまだ小さいため雨は降りません。",
    cloud_developing: "",
    rain: "",
    heavy_rain: "",
    thundercloud:
      "強い上昇気流で雲が縦に発達し、氷晶・霰・過冷却水滴などの衝突による電荷分離が進んでいます。放電条件はまだ不足しています。",
    lightning:
      "氷相の発達と電荷分離が進み、雷発生可能性が目安に達したため放電が起こりました。",
  }[state];
}

function nextDiscoveryFor(state: RainLightningStateId) {
  return {
    sunny: "水蒸気だけでなく、上昇気流や不安定さも一緒に変えてみよう。",
    cloud_forming: "雲を支える上昇気流を強め、粒が育つか観察しよう。",
    cloud_developing: "3つの条件を組み合わせ、雨として落ちる粒を育てよう。",
    rain: "雨が降っても雷とは限りません。氷相と電荷分離に注目しよう。",
    heavy_rain: "雨の強さと雷の条件は別です。不安定さを変えて比べよう。",
    thundercloud: "電荷分離と雷発生可能性が放電の目安へ届くか観察しよう。",
    lightning: "条件を1つずつ下げ、どこで雷・雨・雲へ戻るか確かめよう。",
  }[state];
}

export function evaluateRainLightning(
  input: Readonly<RainLightningInputs>,
): RainLightningEvaluation {
  const inputs = normalizeRainLightningInputs(input);
  const derived = deriveRainLightning(inputs);
  const flags = evaluateRainLightningFlags(inputs, derived);
  const state = selectRainLightningState(flags);

  return {
    inputs,
    derived,
    flags,
    state,
    stateLabel: STATE_LABELS[state],
    explanation: explanationFor(state, inputs, derived),
    missingConditions: missingConditionsFor(state, inputs, derived),
    nextDiscovery: nextDiscoveryFor(state),
    rainDropCount: flags.heavyRain ? 54 : flags.raining ? 24 : 0,
    rainSpeed: flags.heavyRain ? "fast" : flags.raining ? "gentle" : "stopped",
  };
}
