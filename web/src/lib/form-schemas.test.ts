import { describe, expect, it } from "vitest";
import * as v from "valibot";
import {
  createCustomExerciseFormSchema,
  createExerciseConfigFormSchema,
  createMeasurementsFormSchema,
  createRegistrationFormSchema,
  createStartingStrengthFormSchema,
  createTopWeightFormSchema,
  createWeightFormSchema,
} from "./form-schemas";

const t = (_key: string, defaultValue: string) => defaultValue;

describe("form schemas", () => {
  it("trims registration fields and requires an invite code only in invite-only mode", () => {
    expect(
      v.parse(createRegistrationFormSchema(t, false), {
        name: "  Ada  ",
        inviteCode: "  code  ",
      }),
    ).toEqual({ name: "Ada", inviteCode: "code" });

    const result = v.safeParse(createRegistrationFormSchema(t, true), {
      name: "Ada",
      inviteCode: "   ",
    });

    expect(result.success).toBe(false);
    expect(result.issues?.[0]?.message).toBe("An invite code is required");
  });

  it("uses translated field messages", () => {
    const result = v.safeParse(
      createRegistrationFormSchema((key) => `translated:${key}`, false),
      { name: "", inviteCode: "" },
    );

    expect(result.success).toBe(false);
    expect(result.issues?.[0]?.message).toBe("translated:account.enterName");
  });

  it("accepts positive bodyweight and non-negative top weight", () => {
    expect(v.safeParse(createWeightFormSchema(t), { weight: 0 }).success).toBe(false);
    expect(v.safeParse(createWeightFormSchema(t), { weight: 72.5 }).success).toBe(true);
    expect(v.safeParse(createTopWeightFormSchema(t), { weight: 0 }).success).toBe(true);
    expect(v.safeParse(createTopWeightFormSchema(t), { weight: -1 }).success).toBe(false);
  });

  it("requires custom exercise names and body parts", () => {
    const schema = createCustomExerciseFormSchema(t);

    expect(v.safeParse(schema, { name: " ", bodyPart: "chest", description: "" }).success).toBe(
      false,
    );
    expect(v.safeParse(schema, { name: "Press", bodyPart: "", description: "" }).success).toBe(
      false,
    );
  });

  it("requires at least one positive measurement", () => {
    const schema = createMeasurementsFormSchema(t);

    expect(v.safeParse(schema, {}).success).toBe(false);
    expect(v.safeParse(schema, { waist: 0 }).success).toBe(false);
    expect(v.safeParse(schema, { waist: 81.5 }).success).toBe(true);
  });

  it("requires positive weights for every starting-strength lift", () => {
    const schema = createStartingStrengthFormSchema(t);
    const values = {
      experience: "some" as const,
      unit: "kg" as const,
      weights: { "0043": 40, "0025": 40, "0027": 40, "1456": 30, "0032": 60 },
    };

    expect(v.safeParse(schema, values).success).toBe(true);
    expect(
      v.safeParse(schema, { ...values, weights: { ...values.weights, "0032": 0 } }).success,
    ).toBe(false);
  });

  it("rejects invalid exercise configuration numbers before normalization", () => {
    const schema = createExerciseConfigFormSchema(t);

    expect(v.safeParse(schema, { id: "bench", sets: 0 }).success).toBe(true);
    expect(v.safeParse(schema, { id: "bench", sets: -1 }).success).toBe(false);
    expect(v.safeParse(schema, { id: "bench", sets: Number.NaN }).success).toBe(false);
  });
});
