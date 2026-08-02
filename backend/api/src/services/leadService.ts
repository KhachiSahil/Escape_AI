import { Prisma, Role } from "@prisma/client";

import { prisma } from "../db";
import { HttpError } from "../middleware/errorHandler";
import { ADMIN_ROOM, employeeRoom, getIO } from "../realtime/socket";

export interface Actor {
  id: string;
  role: Role;
}

export function createLead(data: Prisma.LeadUncheckedCreateInput) {
  return prisma.lead.create({ data });
}

export async function getLead(id: string) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { calls: true, escalations: true, assignedEmployee: true },
  });
  if (!lead) throw new HttpError(404, "Lead not found");
  return lead;
}

export function listLeads(filters: { status?: string; assignedEmployeeId?: string }) {
  return prisma.lead.findMany({
    where: {
      status: filters.status as never,
      assignedEmployeeId: filters.assignedEmployeeId,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateLead(
  id: string,
  data: Prisma.LeadUncheckedUpdateInput,
  actor?: Actor,
) {
  let payload = data;

  if (actor?.role === "SALES_EMPLOYEE") {
    const existing = await prisma.lead.findUnique({
      where: { id },
      select: { assignedEmployeeId: true },
    });
    if (!existing) throw new HttpError(404, "Lead not found");
    if (existing.assignedEmployeeId !== actor.id) {
      throw new HttpError(403, "Forbidden");
    }
    // Employees may not reassign leads to someone else.
    const { assignedEmployeeId: _ignored, ...rest } = payload;
    payload = rest;
  }

  let updated;
  try {
    updated = await prisma.lead.update({ where: { id }, data: payload });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      throw new HttpError(404, "Lead not found");
    }
    throw err;
  }

  const io = getIO();
  io.to(ADMIN_ROOM).emit("lead:updated", updated);
  if (updated.assignedEmployeeId) {
    io.to(employeeRoom(updated.assignedEmployeeId)).emit("lead:updated", updated);
  }

  return updated;
}

export async function scheduleCallback(id: string, callbackTime: Date, notes?: string) {
  return updateLead(id, {
    nextFollowUp: callbackTime,
    status: "CALLBACK_SCHEDULED",
    notes,
  });
}
