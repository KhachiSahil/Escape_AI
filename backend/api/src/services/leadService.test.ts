import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindUnique, mockUpdate, mockTo } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockTo: vi.fn(() => ({ emit: vi.fn() })),
}));

vi.mock("../db", () => ({
  prisma: {
    lead: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

vi.mock("../realtime/socket", () => ({
  getIO: () => ({ to: mockTo }),
  employeeRoom: (id: string) => `employee:${id}`,
  ADMIN_ROOM: "role:admin",
}));

import { updateLead } from "./leadService";
import { HttpError } from "../middleware/errorHandler";

describe("updateLead ownership authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows ADMIN to update any lead without an ownership check", async () => {
    mockUpdate.mockResolvedValue({ id: "lead-1", assignedEmployeeId: "someone-else" });

    await updateLead("lead-1", { notes: "updated" }, { id: "admin-1", role: "ADMIN" });

    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: "lead-1" }, data: { notes: "updated" } });
  });

  it("allows a SALES_EMPLOYEE to update a lead assigned to them", async () => {
    mockFindUnique.mockResolvedValue({ assignedEmployeeId: "emp-1" });
    mockUpdate.mockResolvedValue({ id: "lead-1", assignedEmployeeId: "emp-1" });

    await updateLead("lead-1", { notes: "my note" }, { id: "emp-1", role: "SALES_EMPLOYEE" });

    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: "lead-1" }, data: { notes: "my note" } });
  });

  it("rejects a SALES_EMPLOYEE updating a lead assigned to someone else (403)", async () => {
    mockFindUnique.mockResolvedValue({ assignedEmployeeId: "other-emp" });

    await expect(
      updateLead("lead-1", { notes: "trying" }, { id: "emp-1", role: "SALES_EMPLOYEE" }),
    ).rejects.toMatchObject(new HttpError(403, "Forbidden"));

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("strips assignedEmployeeId from the payload for a SALES_EMPLOYEE (cannot reassign)", async () => {
    mockFindUnique.mockResolvedValue({ assignedEmployeeId: "emp-1" });
    mockUpdate.mockResolvedValue({ id: "lead-1", assignedEmployeeId: "emp-1" });

    await updateLead(
      "lead-1",
      { notes: "note", assignedEmployeeId: "someone-else" },
      { id: "emp-1", role: "SALES_EMPLOYEE" },
    );

    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: "lead-1" }, data: { notes: "note" } });
  });

  it("404s when the lead doesn't exist for a SALES_EMPLOYEE actor", async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(
      updateLead("missing", { notes: "x" }, { id: "emp-1", role: "SALES_EMPLOYEE" }),
    ).rejects.toMatchObject(new HttpError(404, "Lead not found"));
  });
});
