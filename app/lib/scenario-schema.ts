import { z } from "zod";

const identifier = z.string().regex(/^[a-z][a-z0-9_]{0,47}$/);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const shortText = (max: number) => z.string().trim().min(1).max(max);

export const ScenarioRequestSchema = z
  .object({
    theme: z.string().trim().min(2).max(100),
    audience: z.string().trim().min(2).max(80),
    learningGoal: z.string().trim().min(5).max(200),
  })
  .strict();

export type ScenarioRequest = z.infer<typeof ScenarioRequestSchema>;

export const MetricKeySchema = z.enum([
  "magma",
  "gas",
  "blockage",
  "pressure",
]);
export type MetricKey = z.infer<typeof MetricKeySchema>;

export type NumericExpression =
  | { type: "literal"; value: number }
  | { type: "metric"; metric: MetricKey }
  | {
      type: "operation";
      operator: "add" | "subtract" | "multiply" | "divide" | "min" | "max";
      left: NumericExpression;
      right: NumericExpression;
    }
  | {
      type: "clamp";
      value: NumericExpression;
      min: number;
      max: number;
    };

export const NumericExpressionSchema: z.ZodType<NumericExpression> = z.lazy(
  () =>
    z.discriminatedUnion("type", [
      z
        .object({
          type: z.literal("literal"),
          value: z.number().finite(),
        })
        .strict(),
      z
        .object({
          type: z.literal("metric"),
          metric: MetricKeySchema,
        })
        .strict(),
      z
        .object({
          type: z.literal("operation"),
          operator: z.enum([
            "add",
            "subtract",
            "multiply",
            "divide",
            "min",
            "max",
          ]),
          left: NumericExpressionSchema,
          right: NumericExpressionSchema,
        })
        .strict(),
      z
        .object({
          type: z.literal("clamp"),
          value: NumericExpressionSchema,
          min: z.number().finite(),
          max: z.number().finite(),
        })
        .strict(),
    ]),
);

export type Condition =
  | {
      type: "compare";
      left: NumericExpression;
      operator: "lt" | "lte" | "eq" | "neq" | "gte" | "gt";
      right: NumericExpression;
    }
  | { type: "all"; conditions: Condition[] }
  | { type: "any"; conditions: Condition[] }
  | { type: "not"; condition: Condition };

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z
      .object({
        type: z.literal("compare"),
        left: NumericExpressionSchema,
        operator: z.enum(["lt", "lte", "eq", "neq", "gte", "gt"]),
        right: NumericExpressionSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal("all"),
        conditions: z.array(ConditionSchema).min(1).max(6),
      })
      .strict(),
    z
      .object({
        type: z.literal("any"),
        conditions: z.array(ConditionSchema).min(1).max(6),
      })
      .strict(),
    z
      .object({
        type: z.literal("not"),
        condition: ConditionSchema,
      })
      .strict(),
  ]),
);

const variableSchema = z
  .object({
    label: shortText(48),
    shortLabel: shortText(20),
    description: shortText(180),
    unit: shortText(16),
    min: z.number().finite(),
    max: z.number().finite(),
    step: z.number().finite().positive(),
    accent: color,
  })
  .strict();

const derivedMetricSchema = z
  .object({
    label: shortText(48),
    description: shortText(180),
    unit: shortText(16),
    min: z.number().finite(),
    max: z.number().finite(),
    precision: z.number().int().min(0).max(3),
    expression: NumericExpressionSchema,
  })
  .strict();

const alertStageSchema = z
  .object({
    id: identifier,
    level: z.number().int().min(1).max(5),
    label: shortText(36),
    headline: shortText(80),
    description: shortText(180),
    color,
    when: ConditionSchema.nullable(),
  })
  .strict();

const outcomeSchema = z
  .object({
    title: shortText(80),
    message: shortText(240),
    when: ConditionSchema,
  })
  .strict();

const missionSchema = z
  .object({
    id: identifier,
    title: shortText(80),
    objective: shortText(240),
    activeMessage: shortText(180),
    success: outcomeSchema,
    failure: outcomeSchema,
  })
  .strict();

export const ScenarioOutputSchema = z
  .object({
    id: identifier,
    title: shortText(100),
    location: shortText(100),
    variables: z
      .object({
        magma: variableSchema,
        gas: variableSchema,
        blockage: variableSchema,
      })
      .strict(),
    derived: z
      .object({
        pressure: derivedMetricSchema,
      })
      .strict(),
    alertStages: z.array(alertStageSchema).min(2).max(5),
    eruption: z
      .object({
        title: shortText(80),
        message: shortText(240),
        when: ConditionSchema,
      })
      .strict(),
    missions: z.array(missionSchema).min(1).max(3),
    reset: z
      .object({
        variables: z
          .object({
            magma: z.number().finite(),
            gas: z.number().finite(),
            blockage: z.number().finite(),
          })
          .strict(),
        missionId: identifier,
      })
      .strict(),
  })
  .strict();

function expressionStats(root: NumericExpression) {
  const stack = [root];
  let nodes = 0;
  let referencesPressure = false;
  while (stack.length > 0) {
    const expression = stack.pop();
    if (!expression) continue;
    nodes += 1;
    if (expression.type === "metric") {
      referencesPressure ||= expression.metric === "pressure";
    } else if (expression.type === "operation") {
      stack.push(expression.left, expression.right);
    } else if (expression.type === "clamp") {
      stack.push(expression.value);
    }
    if (nodes > 96) break;
  }
  return { nodes, referencesPressure };
}

function conditionNodeCount(root: Condition) {
  const stack = [root];
  let nodes = 0;
  while (stack.length > 0) {
    const condition = stack.pop();
    if (!condition) continue;
    nodes += 1;
    if (condition.type === "compare") {
      nodes += expressionStats(condition.left).nodes;
      nodes += expressionStats(condition.right).nodes;
    } else if (condition.type === "not") {
      stack.push(condition.condition);
    } else {
      stack.push(...condition.conditions);
    }
    if (nodes > 128) break;
  }
  return nodes;
}

export const ScenarioDefinitionSchema = ScenarioOutputSchema.superRefine(
  (scenario, context) => {
    for (const key of ["magma", "gas", "blockage"] as const) {
      const definition = scenario.variables[key];
      if (definition.min >= definition.max) {
        context.addIssue({
          code: "custom",
          path: ["variables", key, "max"],
          message: "max must be greater than min",
        });
      }
      if (definition.step > definition.max - definition.min) {
        context.addIssue({
          code: "custom",
          path: ["variables", key, "step"],
          message: "step must fit inside the variable range",
        });
      }
      const resetValue = scenario.reset.variables[key];
      if (resetValue < definition.min || resetValue > definition.max) {
        context.addIssue({
          code: "custom",
          path: ["reset", "variables", key],
          message: "reset value must be inside the variable range",
        });
      }
    }

    const pressure = scenario.derived.pressure;
    if (pressure.min >= pressure.max) {
      context.addIssue({
        code: "custom",
        path: ["derived", "pressure", "max"],
        message: "max must be greater than min",
      });
    }
    const pressureStats = expressionStats(pressure.expression);
    if (pressureStats.referencesPressure) {
      context.addIssue({
        code: "custom",
        path: ["derived", "pressure", "expression"],
        message: "pressure cannot reference itself",
      });
    }
    if (pressureStats.nodes > 96) {
      context.addIssue({
        code: "custom",
        path: ["derived", "pressure", "expression"],
        message: "expression is too complex",
      });
    }

    const missionIds = new Set<string>();
    scenario.missions.forEach((mission, index) => {
      if (missionIds.has(mission.id)) {
        context.addIssue({
          code: "custom",
          path: ["missions", index, "id"],
          message: "mission ids must be unique",
        });
      }
      missionIds.add(mission.id);
      if (
        conditionNodeCount(mission.success.when) > 128 ||
        conditionNodeCount(mission.failure.when) > 128
      ) {
        context.addIssue({
          code: "custom",
          path: ["missions", index],
          message: "mission conditions are too complex",
        });
      }
    });
    if (!missionIds.has(scenario.reset.missionId)) {
      context.addIssue({
        code: "custom",
        path: ["reset", "missionId"],
        message: "reset missionId must reference a mission",
      });
    }

    const fallbackStages = scenario.alertStages.filter(
      (stage) => stage.when === null,
    );
    if (
      fallbackStages.length !== 1 ||
      scenario.alertStages.at(-1)?.when !== null
    ) {
      context.addIssue({
        code: "custom",
        path: ["alertStages"],
        message: "exactly one final fallback stage is required",
      });
    }

    const ids = new Set<string>();
    scenario.alertStages.forEach((stage, index) => {
      if (ids.has(stage.id)) {
        context.addIssue({
          code: "custom",
          path: ["alertStages", index, "id"],
          message: "alert stage ids must be unique",
        });
      }
      ids.add(stage.id);
      if (stage.when && conditionNodeCount(stage.when) > 128) {
        context.addIssue({
          code: "custom",
          path: ["alertStages", index, "when"],
          message: "condition is too complex",
        });
      }
    });

    if (conditionNodeCount(scenario.eruption.when) > 128) {
      context.addIssue({
        code: "custom",
        path: ["eruption", "when"],
        message: "condition is too complex",
      });
    }
  },
);

export type ScenarioDefinition = z.infer<typeof ScenarioOutputSchema>;
