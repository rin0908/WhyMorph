export const VARIABLE_KEYS = ["magma", "gas", "blockage"] as const;
export const DERIVED_KEYS = ["pressure"] as const;
export const NUMERIC_OPERATORS = ["add", "subtract", "multiply", "divide", "min", "max"] as const;
export const COMPARISON_OPERATORS = ["lt", "lte", "eq", "neq", "gte", "gt"] as const;

export type VariableKey = (typeof VARIABLE_KEYS)[number];
export type DerivedKey = (typeof DERIVED_KEYS)[number];
export type MetricKey = VariableKey | DerivedKey;
export type NumericOperator = (typeof NUMERIC_OPERATORS)[number];
export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];
export type SimulationVariables = Record<VariableKey, number>;
export type DerivedMetrics = Record<DerivedKey, number>;
export type SimulationMetrics = SimulationVariables & DerivedMetrics;

export type NumericExpression =
  | Readonly<{ type: "literal"; value: number }>
  | Readonly<{ type: "metric"; metric: MetricKey }>
  | Readonly<{ type: "operation"; operator: NumericOperator; left: NumericExpression; right: NumericExpression }>
  | Readonly<{ type: "clamp"; value: NumericExpression; min: number; max: number }>;

export type Condition =
  | Readonly<{ type: "compare"; left: NumericExpression; operator: ComparisonOperator; right: NumericExpression }>
  | Readonly<{ type: "all"; conditions: readonly Condition[] }>
  | Readonly<{ type: "any"; conditions: readonly Condition[] }>
  | Readonly<{ type: "not"; condition: Condition }>;

export interface VariableDefinition {
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  readonly unit: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly accent: string;
}

export interface DerivedMetricDefinition {
  readonly label: string;
  readonly description: string;
  readonly unit: string;
  readonly min: number;
  readonly max: number;
  readonly precision: number;
  readonly expression: NumericExpression;
}

export interface AlertStageDefinition {
  readonly id: string;
  readonly level: number;
  readonly label: string;
  readonly headline: string;
  readonly description: string;
  readonly color: string;
  readonly when: Condition | null;
}

export interface OutcomeDefinition {
  readonly title: string;
  readonly message: string;
  readonly when: Condition;
}

export interface MissionDefinition<M extends string = string> {
  readonly id: M;
  readonly title: string;
  readonly objective: string;
  readonly activeMessage: string;
  readonly success: OutcomeDefinition;
  readonly failure: OutcomeDefinition;
}

export interface ScenarioDefinition<M extends string = string> {
  readonly id: string;
  readonly title: string;
  readonly location: string;
  readonly variables: Readonly<Record<VariableKey, VariableDefinition>>;
  readonly derived: Readonly<Record<DerivedKey, DerivedMetricDefinition>>;
  readonly alertStages: readonly AlertStageDefinition[];
  readonly eruption: Readonly<{ title: string; message: string; when: Condition }>;
  readonly missions: readonly MissionDefinition<M>[];
  readonly reset: Readonly<{ variables: Readonly<SimulationVariables>; missionId: M }>;
}

export type VolcanoScenario<M extends string = string> = ScenarioDefinition<M>;

export interface SimulationState<M extends string = string> {
  readonly variables: SimulationVariables;
  readonly missionId: M;
}

export type MissionStatus = "active" | "success" | "failure";

export interface SimulationSnapshot<M extends string = string> {
  readonly variables: SimulationVariables;
  readonly derived: DerivedMetrics;
  readonly metrics: SimulationMetrics;
  readonly alert: Omit<AlertStageDefinition, "when">;
  readonly eruption: boolean;
  readonly eruptionTitle: string | null;
  readonly eruptionMessage: string | null;
  readonly mission: Readonly<{
    id: M;
    title: string;
    objective: string;
    status: MissionStatus;
    statusTitle: string;
    message: string;
  }>;
}

type MetricReader = (key: MetricKey) => number;
const variableKeys: ReadonlySet<string> = new Set(VARIABLE_KEYS);
const derivedKeys: ReadonlySet<string> = new Set(DERIVED_KEYS);

function unsupported(value: never, category: string): never {
  let rendered: string;
  try { rendered = JSON.stringify(value); } catch { rendered = String(value); }
  throw new Error("Unsupported " + category + ": " + rendered);
}

function finite(value: number, label: string) {
  if (!Number.isFinite(value)) throw new RangeError(label + " must be a finite number.");
  return value;
}

function clamp(value: number, min: number, max: number) {
  if (min > max) throw new RangeError("Invalid range: " + min + " > " + max + ".");
  return Math.min(max, Math.max(min, value));
}

function applyOperator(operator: NumericOperator, left: number, right: number) {
  let result: number;
  switch (operator) {
    case "add": result = left + right; break;
    case "subtract": result = left - right; break;
    case "multiply": result = left * right; break;
    case "divide":
      if (right === 0) throw new RangeError("Division by zero is not allowed.");
      result = left / right;
      break;
    case "min": result = Math.min(left, right); break;
    case "max": result = Math.max(left, right); break;
    default: return unsupported(operator, "numeric operator");
  }
  return finite(result, "Result of " + operator);
}

function evaluateNumericWithReader(expression: NumericExpression, read: MetricReader): number {
  switch (expression.type) {
    case "literal": return finite(expression.value, "Numeric literal");
    case "metric": return finite(read(expression.metric), "Metric " + expression.metric);
    case "operation":
      return applyOperator(
        expression.operator,
        evaluateNumericWithReader(expression.left, read),
        evaluateNumericWithReader(expression.right, read),
      );
    case "clamp":
      return clamp(
        evaluateNumericWithReader(expression.value, read),
        finite(expression.min, "Clamp min"),
        finite(expression.max, "Clamp max"),
      );
    default: return unsupported(expression, "numeric expression");
  }
}

export function evaluateNumericExpression(
  expression: NumericExpression,
  metrics: Readonly<SimulationMetrics>,
) {
  return evaluateNumericWithReader(expression, (key) => {
    const value = metrics[key];
    if (typeof value !== "number") throw new Error("Unknown metric: " + String(key));
    return value;
  });
}

function compare(left: number, operator: ComparisonOperator, right: number) {
  switch (operator) {
    case "lt": return left < right;
    case "lte": return left <= right;
    case "eq": return left === right;
    case "neq": return left !== right;
    case "gte": return left >= right;
    case "gt": return left > right;
    default: return unsupported(operator, "comparison operator");
  }
}

export function evaluateCondition(rule: Condition, metrics: Readonly<SimulationMetrics>): boolean {
  switch (rule.type) {
    case "compare":
      return compare(
        evaluateNumericExpression(rule.left, metrics),
        rule.operator,
        evaluateNumericExpression(rule.right, metrics),
      );
    case "all": return rule.conditions.every((condition) => evaluateCondition(condition, metrics));
    case "any": return rule.conditions.some((condition) => evaluateCondition(condition, metrics));
    case "not": return !evaluateCondition(rule.condition, metrics);
    default: return unsupported(rule, "condition");
  }
}

function normalize<M extends string>(
  scenario: ScenarioDefinition<M>,
  variables: Readonly<SimulationVariables>,
): SimulationVariables {
  return Object.fromEntries(
    VARIABLE_KEYS.map((key) => {
      const spec = scenario.variables[key];
      return [key, clamp(finite(variables[key], key), spec.min, spec.max)];
    }),
  ) as SimulationVariables;
}

export function computeDerivedMetrics<M extends string>(
  scenario: ScenarioDefinition<M>,
  input: Readonly<SimulationVariables>,
): DerivedMetrics {
  const variables = normalize(scenario, input);
  const cache: Partial<DerivedMetrics> = {};
  const resolving = new Set<DerivedKey>();

  const read: MetricReader = (key) => {
    if (variableKeys.has(key)) return variables[key as VariableKey];
    if (!derivedKeys.has(key)) throw new Error("Unknown metric: " + String(key));
    const derivedKey = key as DerivedKey;
    if (cache[derivedKey] !== undefined) return cache[derivedKey] as number;
    if (resolving.has(derivedKey)) {
      throw new Error("Circular derived metric rule detected at " + derivedKey + ".");
    }
    resolving.add(derivedKey);
    try {
      const spec = scenario.derived[derivedKey];
      const raw = evaluateNumericWithReader(spec.expression, read);
      const factor = 10 ** spec.precision;
      const value = Math.round(clamp(raw, spec.min, spec.max) * factor) / factor;
      cache[derivedKey] = value;
      return value;
    } finally {
      resolving.delete(derivedKey);
    }
  };

  return Object.fromEntries(DERIVED_KEYS.map((key) => [key, read(key)])) as DerivedMetrics;
}

function missionFor<M extends string>(scenario: ScenarioDefinition<M>, id: M) {
  const mission = scenario.missions.find((candidate) => candidate.id === id);
  if (!mission) throw new Error("Unknown mission: " + id + ".");
  return mission;
}

export function createInitialSimulationState<M extends string>(
  scenario: ScenarioDefinition<M>,
): SimulationState<M> {
  missionFor(scenario, scenario.reset.missionId);
  return {
    variables: normalize(scenario, scenario.reset.variables),
    missionId: scenario.reset.missionId,
  };
}

export function resetSimulation<M extends string>(scenario: ScenarioDefinition<M>) {
  return createInitialSimulationState(scenario);
}

export function setSimulationVariable<M extends string>(
  scenario: ScenarioDefinition<M>,
  state: Readonly<SimulationState<M>>,
  key: VariableKey,
  value: number,
): SimulationState<M> {
  const spec = scenario.variables[key];
  return {
    ...state,
    variables: {
      ...state.variables,
      [key]: clamp(finite(value, key), spec.min, spec.max),
    },
  };
}

export function adjustSimulationVariable<M extends string>(
  scenario: ScenarioDefinition<M>,
  state: Readonly<SimulationState<M>>,
  key: VariableKey,
  delta: number,
) {
  return setSimulationVariable(
    scenario,
    state,
    key,
    state.variables[key] + finite(delta, key),
  );
}

export function applyVariableDelta<M extends string>(
  state: Readonly<SimulationState<M>>,
  key: VariableKey,
  delta: number,
): SimulationState<M> {
  return {
    ...state,
    variables: {
      ...state.variables,
      [key]: clamp(state.variables[key] + finite(delta, key), 0, 100),
    },
  };
}

export function evaluateSimulation<M extends string>(
  scenario: ScenarioDefinition<M>,
  state: Readonly<SimulationState<M>>,
): SimulationSnapshot<M> {
  const variables = normalize(scenario, state.variables);
  const derived = computeDerivedMetrics(scenario, variables);
  const metrics: SimulationMetrics = { ...variables, ...derived };
  const selected = scenario.alertStages.find(
    (stage) => stage.when === null || evaluateCondition(stage.when, metrics),
  );
  if (!selected) throw new Error("No alert stage matched; add a null fallback.");
  const { when: _when, ...alert } = selected;
  void _when;
  const eruption = evaluateCondition(scenario.eruption.when, metrics);
  const mission = missionFor(scenario, state.missionId);

  let status: MissionStatus = "active";
  let statusTitle = mission.title;
  let message = mission.activeMessage;
  if (evaluateCondition(mission.failure.when, metrics)) {
    status = "failure";
    statusTitle = mission.failure.title;
    message = mission.failure.message;
  } else if (evaluateCondition(mission.success.when, metrics)) {
    status = "success";
    statusTitle = mission.success.title;
    message = mission.success.message;
  }

  return {
    variables,
    derived,
    metrics,
    alert,
    eruption,
    eruptionTitle: eruption ? scenario.eruption.title : null,
    eruptionMessage: eruption ? scenario.eruption.message : null,
    mission: {
      id: mission.id,
      title: mission.title,
      objective: mission.objective,
      status,
      statusTitle,
      message,
    },
  };
}

export function evaluateScenario<M extends string>(
  scenario: ScenarioDefinition<M>,
  input: Readonly<SimulationVariables> | Readonly<SimulationState<M>>,
): SimulationSnapshot<M> {
  const state =
    "variables" in input
      ? input
      : { variables: input as SimulationVariables, missionId: scenario.reset.missionId };
  return evaluateSimulation(scenario, state);
}
