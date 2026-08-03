import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockQueryRaw, mockEmployeeUpdate, mockEscalationCreate, mockLeadUpdate, mockEscalationFindMany, mockTo } =
  vi.hoisted(() => {
    const mockEmit = vi.fn();
    return {
      mockQueryRaw: vi.fn(),
      mockEmployeeUpdate: vi.fn(),
      mockEscalationCreate: vi.fn(),
      mockLeadUpdate: vi.fn(),
      mockEscalationFindMany: vi.fn(),
      mockTo: vi.fn(() => ({ emit: mockEmit })),
    };
  });

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
    escalation: { findMany: mockEscalationFindMany },
  },
}));

vi.mock("../realtime/socket", () => ({
  getIO: () => ({ to: mockTo }),
  employeeRoom: (id: string) => `employee:${id}`,
  ADMIN_ROOM: "role:admin",
}));

import { createEscalation, listEscalations } from "./escalationService";

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

describe("listEscalations queued-priority ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sorts queued escalations by lead priority (P1 first), then createdAt", async () => {
    const older = {
      id: "esc-p3",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      lead: { priority: "P3" },
    };
    const newerP1 = {
      id: "esc-p1",
      createdAt: new Date("2026-01-02T00:00:00Z"),
      lead: { priority: "P1" },
    };
    const noPriority = {
      id: "esc-none",
      createdAt: new Date("2026-01-01T12:00:00Z"),
      lead: { priority: null },
    };
    mockEscalationFindMany.mockResolvedValue([older, newerP1, noPriority]);

    const result = await listEscalations({ status: "queued" });

    expect(result.map((e) => e.id)).toEqual(["esc-p1", "esc-p3", "esc-none"]);
  });

  it("does not reorder non-queued escalation lists", async () => {
    const rows = [
      { id: "esc-a", createdAt: new Date("2026-01-01T00:00:00Z"), lead: { priority: "P4" } },
      { id: "esc-b", createdAt: new Date("2026-01-02T00:00:00Z"), lead: { priority: "P1" } },
    ];
    mockEscalationFindMany.mockResolvedValue(rows);

    const result = await listEscalations({ status: "assigned" });

    expect(result.map((e) => e.id)).toEqual(["esc-a", "esc-b"]);
  });
});
