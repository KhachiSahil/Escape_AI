import { Prisma } from "@prisma/client";

import { prisma } from "../db";
import { ADMIN_ROOM, employeeRoom, getIO } from "../realtime/socket";

export async function createCall(data: Prisma.CallUncheckedCreateInput) {
  let payload = data;

  // Escalation-to-call auto-linking: a manually-logged HUMAN call that
  // doesn't specify who handled it inherits the lead's most recent
  // non-resolved escalation's assignee, if any.
  if (payload.callType === "HUMAN" && !payload.handledByEmployeeId) {
    const escalation = await prisma.escalation.findFirst({
      where: { leadId: payload.leadId as string, status: { not: "resolved" } },
      orderBy: { createdAt: "desc" },
      select: { assignedEmployeeId: true },
    });
    if (escalation?.assignedEmployeeId) {
      payload = { ...payload, handledByEmployeeId: escalation.assignedEmployeeId };
    }
  }

  const call = await prisma.call.create({
    data: payload,
    include: { lead: { select: { assignedEmployeeId: true } } },
  });

  const io = getIO();
  const { lead, ...callFields } = call;
  io.to(ADMIN_ROOM).emit("call:logged", callFields);
  if (lead.assignedEmployeeId) {
    io.to(employeeRoom(lead.assignedEmployeeId)).emit("call:logged", callFields);
  }

  return callFields;
}

export function listCalls(filters: {
  leadId?: string;
  handledByEmployeeId?: string;
  from?: Date;
  to?: Date;
}) {
  const createdAt: Prisma.DateTimeFilter = {};
  if (filters.from) createdAt.gte = filters.from;
  if (filters.to) createdAt.lt = filters.to;

  return prisma.call.findMany({
    where: {
      leadId: filters.leadId,
      handledByEmployeeId: filters.handledByEmployeeId,
      createdAt: filters.from || filters.to ? createdAt : undefined,
    },
    include: { lead: { select: { name: true, phone: true } } },
    orderBy: { createdAt: "desc" },
  });
}
