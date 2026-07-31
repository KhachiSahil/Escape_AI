import { Prisma } from "@prisma/client";

import { prisma } from "../db";

export function createCall(data: Prisma.CallUncheckedCreateInput) {
  return prisma.call.create({ data });
}
