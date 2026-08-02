import { prisma } from "../db";

/**
 * Every metric here is derived only from fields that actually exist in the
 * schema. Metrics the spec asked for that aren't derivable from current data
 * (revenue forecast - no deal-value field anywhere; missed calls - no
 * attempted-but-not-connected concept exists) are intentionally not included
 * here rather than fabricated.
 */
export async function getOverview() {
  const [byStatus, bySource, byCourse, bySentiment, callDuration] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["leadSource"], _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["courseInterested"], _count: { _all: true } }),
    prisma.call.groupBy({ by: ["sentiment"], _count: { _all: true } }),
    prisma.call.aggregate({
      _avg: { durationSeconds: true },
      _sum: { durationSeconds: true },
      _count: { durationSeconds: true },
    }),
  ]);

  const converted = byStatus.find((s) => s.status === "CONVERTED")?._count._all ?? 0;
  const lost = byStatus.find((s) => s.status === "LOST")?._count._all ?? 0;
  const total = byStatus.reduce((sum, s) => sum + s._count._all, 0);

  const now = new Date();
  const [followUpConverted, followUpNotConverted] = await Promise.all([
    prisma.lead.count({
      where: { nextFollowUp: { lt: now }, status: "CONVERTED" },
    }),
    prisma.lead.count({
      where: { nextFollowUp: { lt: now }, status: { not: "CONVERTED" } },
    }),
  ]);

  return {
    pipelineByStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
    leadsBySource: bySource.map((s) => ({ source: s.leadSource, count: s._count._all })),
    leadsByCourse: byCourse.map((s) => ({
      course: s.courseInterested ?? "Unspecified",
      count: s._count._all,
    })),
    sentimentDistribution: {
      note: "Call.sentiment is free-text, not an enum - values may fragment across casing/wording until it becomes an enum.",
      data: bySentiment.map((s) => ({ sentiment: s.sentiment ?? "Unspecified", count: s._count._all })),
    },
    callDuration: {
      avgSeconds: callDuration._avg.durationSeconds,
      totalSeconds: callDuration._sum.durationSeconds,
      callsWithDuration: callDuration._count.durationSeconds,
    },
    conversionRate: {
      convertedOverTotal: total > 0 ? converted / total : null,
      convertedOverResolved: converted + lost > 0 ? converted / (converted + lost) : null,
    },
    followUpSuccess: {
      note: "Approximation: leads whose nextFollowUp date has passed, split by whether they ended up CONVERTED. Does not track which specific callback led to conversion.",
      convertedAfterFollowUp: followUpConverted,
      notConvertedAfterFollowUp: followUpNotConverted,
    },
  };
}

export async function getEmployeePerformance() {
  const employees = await prisma.employee.findMany({
    where: { role: "SALES_EMPLOYEE" },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      assignedLeads: { select: { status: true } },
    },
    orderBy: { name: "asc" },
  });

  return employees.map((employee) => {
    const statusCounts: Record<string, number> = {};
    for (const lead of employee.assignedLeads) {
      statusCounts[lead.status] = (statusCounts[lead.status] ?? 0) + 1;
    }
    return {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      status: employee.status,
      totalAssigned: employee.assignedLeads.length,
      byStatus: statusCounts,
    };
  });
}
