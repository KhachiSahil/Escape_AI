import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCallCreate, mockEscalationFindFirst, mockTo } = vi.hoisted(() => ({
  mockCallCreate: vi.fn(),
  mockEscalationFindFirst: vi.fn(),
  mockTo: vi.fn(() => ({ emit: vi.fn() })),
}));

vi.mock("../db", () => ({
  prisma: {
    call: { create: mockCallCreate },
    escalation: { findFirst: mockEscalationFindFirst },
  },
}));

vi.mock("../realtime/socket", () => ({
  getIO: () => ({ to: mockTo }),
  employeeRoom: (id: string) => `employee:${id}`,
  ADMIN_ROOM: "role:admin",
}));

import { createCall } from "./callService";

describe("createCall escalation-to-call auto-linking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("auto-links handledByEmployeeId from the most recent non-resolved escalation for a HUMAN call", async () => {
    mockEscalationFindFirst.mockResolvedValue({ assignedEmployeeId: "emp-1" });
    mockCallCreate.mockResolvedValue({ id: "call-1", lead: { assignedEmployeeId: "emp-1" } });

    await createCall({ leadId: "lead-1", callType: "HUMAN" });

    expect(mockEscalationFindFirst).toHaveBeenCalledWith({
      where: { leadId: "lead-1", status: { not: "resolved" } },
      orderBy: { createdAt: "desc" },
      select: { assignedEmployeeId: true },
    });
    expect(mockCallCreate).toHaveBeenCalledWith({
      data: { leadId: "lead-1", callType: "HUMAN", handledByEmployeeId: "emp-1" },
      include: { lead: { select: { assignedEmployeeId: true } } },
    });
  });

  it("does not look up an escalation when handledByEmployeeId is already provided", async () => {
    mockCallCreate.mockResolvedValue({ id: "call-1", lead: { assignedEmployeeId: "emp-2" } });

    await createCall({ leadId: "lead-1", callType: "HUMAN", handledByEmployeeId: "emp-2" });

    expect(mockEscalationFindFirst).not.toHaveBeenCalled();
    expect(mockCallCreate).toHaveBeenCalledWith({
      data: { leadId: "lead-1", callType: "HUMAN", handledByEmployeeId: "emp-2" },
      include: { lead: { select: { assignedEmployeeId: true } } },
    });
  });

  it("does not attempt auto-linking for non-HUMAN call types", async () => {
    mockCallCreate.mockResolvedValue({ id: "call-1", lead: { assignedEmployeeId: null } });

    await createCall({ leadId: "lead-1", callType: "AI_INBOUND" });

    expect(mockEscalationFindFirst).not.toHaveBeenCalled();
  });

  it("leaves handledByEmployeeId unset when no eligible escalation exists", async () => {
    mockEscalationFindFirst.mockResolvedValue(null);
    mockCallCreate.mockResolvedValue({ id: "call-1", lead: { assignedEmployeeId: null } });

    await createCall({ leadId: "lead-1", callType: "HUMAN" });

    expect(mockCallCreate).toHaveBeenCalledWith({
      data: { leadId: "lead-1", callType: "HUMAN" },
      include: { lead: { select: { assignedEmployeeId: true } } },
    });
  });
});
