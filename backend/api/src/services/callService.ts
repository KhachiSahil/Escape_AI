import { Prisma } from "@prisma/client";

import { prisma } from "../db";
import { ADMIN_ROOM, employeeRoom, getIO } from "../realtime/socket";

export async function createCall(data: Prisma.CallUncheckedCreateInput) {
  const call = await prisma.call.create({
    data,
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
