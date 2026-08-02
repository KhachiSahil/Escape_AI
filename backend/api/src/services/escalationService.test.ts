import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQueryRaw = vi.fn();
const mockEmployeeUpdate = vi.fn();
const mockEscalationCreate = vi.fn();
const mockLeadUpdate = vi.fn();
const mockEmit = vi.fn();
const mockTo = vi.fn(() => ({ emit: mockEmit }));

vi.mock("../db", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        $queryRaw: mockQueryRaw,
        employee: { update: mockEmployeeUpdate },
        escalation: { create: mockEscalationCreate },
        lead: { update: mockLeadUpdate },
      }),
    ),
    escalation: { findMany: vi.fn() },
  },
}));

vi.mock("../realtime/socket", () => ({
  getIO: () => ({ to: mockTo }),
  employeeRoom: (id: string) => `employee:${id}`,
  ADMIN_ROOM: "role:admin",
}));

import { createEscalation } from "./escalationService";

describe("createEscalation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assigns to the employee returned by the round-robin query and emits to both rooms", async () => {
    const employee = { id: "emp-1", name: "Employee One" };
    mockQueryRaw.mockResolvedValue([employee]);
    mockEscalationCreate.mockResolvedValue({ id: "esc-1", status: "assigned" });

    const result = await createEscalation({ leadId: "lead-1", reason: "refund_dispute" });

    expect(mockEmployeeUpdate).toHaveBeenCalledWith({
      where: { id: "emp-1" },
      data: { lastAssignedAt: expect.any(Date) },
    });
    expect(mockEscalationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ assignedEmployeeId: "emp-1", status: "assigned" }),
    });
    expect(mockLeadUpdate).toHaveBeenCalledWith({
      where: { id: "lead-1" },
      data: expect.objectContaining({ status: "ESCALATED", assignedEmployeeId: "emp-1" }),
    });
    expect(mockTo).toHaveBeenCalledWith("role:admin");
    expect(mockTo).toHaveBeenCalledWith("employee:emp-1");
    expect(result.assignedEmployee).toEqual(employee);
  });

  it("queues the escalation when no eligible employee is returned", async () => {
    mockQueryRaw.mockResolvedValue([]);
    mockEscalationCreate.mockResolvedValue({ id: "esc-2", status: "queued" });

    const result = await createEscalation({ leadId: "lead-2", reason: "complaint" });

    expect(mockEmployeeUpdate).not.toHaveBeenCalled();
    expect(mockEscalationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ assignedEmployeeId: undefined, status: "queued" }),
    });
    // Only the admin room gets notified - no employee was assigned to notify.
    expect(mockTo).toHaveBeenCalledWith("role:admin");
    expect(mockTo).not.toHaveBeenCalledWith(expect.stringMatching(/^employee:/));
    expect(result.assignedEmployee).toBeNull();
  });

  it("passes explicit maxWait/timeout options to $transaction", async () => {
    mockQueryRaw.mockResolvedValue([]);
    mockEscalationCreate.mockResolvedValue({ id: "esc-3", status: "queued" });

    const { prisma } = await import("../db");
    await createEscalation({ leadId: "lead-3", reason: "payment_failure" });

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { maxWait: 5000, timeout: 10000 },
    );
  });
});
