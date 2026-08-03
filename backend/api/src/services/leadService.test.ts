import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindUnique, mockUpdate, mockTo, mockEmployeeFindUnique, mockSendEmail } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockTo: vi.fn(() => ({ emit: vi.fn() })),
  mockEmployeeFindUnique: vi.fn(),
  mockSendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../db", () => ({
  prisma: {
    lead: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
    employee: {
      findUnique: mockEmployeeFindUnique,
    },
  },
}));

vi.mock("./notificationService", () => ({ sendEmail: mockSendEmail }));

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

  it("lets a SALES_EMPLOYEE set priority on their own lead while assignedEmployeeId is still stripped", async () => {
    mockFindUnique.mockResolvedValue({ assignedEmployeeId: "emp-1" });
    mockUpdate.mockResolvedValue({ id: "lead-1", assignedEmployeeId: "emp-1", priority: "P1" });

    await updateLead(
      "lead-1",
      { priority: "P1", assignedEmployeeId: "someone-else" },
      { id: "emp-1", role: "SALES_EMPLOYEE" },
    );

    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: "lead-1" }, data: { priority: "P1" } });
  });
});

describe("updateLead composite score recomputation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recomputes compositeScore when a sub-score field is in the payload", async () => {
    mockFindUnique.mockResolvedValue({
      budgetScore: null,
      urgencyScore: null,
      interestScore: null,
      buyingSignalsScore: null,
      courseFitScore: null,
      callQualityScore: null,
    });
    mockUpdate.mockResolvedValue({ id: "lead-1" });

    await updateLead("lead-1", { budgetScore: 8 }, { id: "admin-1", role: "ADMIN" });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "lead-1" },
      data: { budgetScore: 8, compositeScore: 8 },
    });
  });

  it("does not touch compositeScore or query the existing lead on an unrelated update", async () => {
    mockUpdate.mockResolvedValue({ id: "lead-1" });

    await updateLead("lead-1", { notes: "just a note" }, { id: "admin-1", role: "ADMIN" });

    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "lead-1" },
      data: { notes: "just a note" },
    });
  });
});

describe("updateLead reassignment email notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emails the newly assigned employee when assignedEmployeeId actually changes", async () => {
    mockFindUnique.mockResolvedValue({ assignedEmployeeId: "old-emp" });
    mockUpdate.mockResolvedValue({ id: "lead-1", assignedEmployeeId: "new-emp" });
    mockEmployeeFindUnique.mockResolvedValue({ email: "new-emp@example.com" });

    await updateLead("lead-1", { assignedEmployeeId: "new-emp" }, { id: "admin-1", role: "ADMIN" });

    // Wait a tick for the fire-and-forget notification promise to resolve.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockSendEmail).toHaveBeenCalledWith(
      "new-emp@example.com",
      expect.stringContaining("assigned"),
      expect.stringContaining("lead-1"),
    );
  });

  it("does not email when assignedEmployeeId is set to the same value it already was", async () => {
    mockFindUnique.mockResolvedValue({ assignedEmployeeId: "emp-1" });
    mockUpdate.mockResolvedValue({ id: "lead-1", assignedEmployeeId: "emp-1" });

    await updateLead("lead-1", { assignedEmployeeId: "emp-1" }, { id: "admin-1", role: "ADMIN" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("does not email when assignedEmployeeId is not part of the update payload", async () => {
    mockUpdate.mockResolvedValue({ id: "lead-1", assignedEmployeeId: "emp-1" });

    await updateLead("lead-1", { notes: "unrelated" }, { id: "admin-1", role: "ADMIN" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
