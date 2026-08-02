import { describe, expect, it } from "vitest";

import { createCallSchema, createLeadSchema, updateLeadSchema } from "./schemas";

describe("createLeadSchema", () => {
  it("accepts a valid payload", () => {
    const result = createLeadSchema.safeParse({
      name: "Jane Doe",
      phone: "+911234567890",
      courseInterested: "Data Science",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a name over 255 characters", () => {
    const result = createLeadSchema.safeParse({
      name: "a".repeat(256),
      phone: "+911234567890",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a phone over 30 characters", () => {
    const result = createLeadSchema.safeParse({
      phone: "1".repeat(31),
    });
    expect(result.success).toBe(false);
  });
});

describe("updateLeadSchema", () => {
  it("rejects a non-cuid assignedEmployeeId", () => {
    const result = updateLeadSchema.safeParse({ assignedEmployeeId: "not-a-cuid" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid cuid assignedEmployeeId", () => {
    const result = updateLeadSchema.safeParse({ assignedEmployeeId: "cldx1a2b30000qzrmn831p5n" });
    expect(result.success).toBe(true);
  });

  it("rejects notes over 5000 characters", () => {
    const result = updateLeadSchema.safeParse({ notes: "a".repeat(5001) });
    expect(result.success).toBe(false);
  });

  it("accepts a valid priority value", () => {
    const result = updateLeadSchema.safeParse({ priority: "P1" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid priority value", () => {
    const result = updateLeadSchema.safeParse({ priority: "P5" });
    expect(result.success).toBe(false);
  });
});

describe("createCallSchema", () => {
  it("rejects a malformed recordingUrl", () => {
    const result = createCallSchema.safeParse({
      leadId: "cldx1a2b30000qzrmn831p5n",
      callType: "AI_INBOUND",
      recordingUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid recordingUrl", () => {
    const result = createCallSchema.safeParse({
      leadId: "cldx1a2b30000qzrmn831p5n",
      callType: "AI_INBOUND",
      recordingUrl: "https://example.com/recording.mp3",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-cuid leadId", () => {
    const result = createCallSchema.safeParse({
      leadId: "not-a-cuid",
      callType: "AI_INBOUND",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid handledByEmployeeId", () => {
    const result = createCallSchema.safeParse({
      leadId: "cldx1a2b30000qzrmn831p5n",
      callType: "HUMAN",
      handledByEmployeeId: "cldx1a2b30000qzrmn831p5n",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-cuid handledByEmployeeId", () => {
    const result = createCallSchema.safeParse({
      leadId: "cldx1a2b30000qzrmn831p5n",
      callType: "HUMAN",
      handledByEmployeeId: "not-a-cuid",
    });
    expect(result.success).toBe(false);
  });

  it("still accepts a payload without handledByEmployeeId (AI calls)", () => {
    const result = createCallSchema.safeParse({
      leadId: "cldx1a2b30000qzrmn831p5n",
      callType: "AI_INBOUND",
    });
    expect(result.success).toBe(true);
  });
});
