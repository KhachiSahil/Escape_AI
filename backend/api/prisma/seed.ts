import bcrypt from "bcrypt";

import { prisma } from "../src/db";

async function main() {
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  await prisma.employee.upsert({
    where: { email: "admin@escapeai.dev" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@escapeai.dev",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  const employeePasswordHash = await bcrypt.hash("employee123", 10);
  const employees = [
    { name: "Employee One", email: "employee1@escapeai.dev", status: "ACTIVE" as const },
    { name: "Employee Two", email: "employee2@escapeai.dev", status: "ACTIVE" as const },
    { name: "Employee Three", email: "employee3@escapeai.dev", status: "ACTIVE" as const },
    { name: "Employee OnLeave", email: "employee4@escapeai.dev", status: "ON_LEAVE" as const },
  ];

  for (const emp of employees) {
    await prisma.employee.upsert({
      where: { email: emp.email },
      update: { status: emp.status },
      create: {
        name: emp.name,
        email: emp.email,
        passwordHash: employeePasswordHash,
        role: "SALES_EMPLOYEE",
        status: emp.status,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log("Seed complete: 1 admin, 3 active employees, 1 on-leave employee.");
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
