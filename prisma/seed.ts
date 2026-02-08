import { PrismaClient } from "@prisma/client";
import { nflTeams } from "./seed-data/nfl-teams";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...\n");

  // ─── NFL Teams ──────────────────────────────────
  console.log("Seeding NFL teams...");

  // Idempotent: clear existing NFL teams and re-insert
  await prisma.team.deleteMany({ where: { sport: "NFL" } });

  const result = await prisma.team.createMany({
    data: nflTeams,
  });

  console.log(`  ${result.count} NFL teams seeded`);

  // Verify
  const byConference = await prisma.team.groupBy({
    by: ["conference"],
    where: { sport: "NFL" },
    _count: true,
  });
  for (const group of byConference) {
    console.log(`  ${group.conference}: ${group._count} teams`);
  }

  // ─── Summary ────────────────────────────────────
  const totalTeams = await prisma.team.count();
  console.log(`\nTotal teams in database: ${totalTeams}`);
  console.log("Seeding complete!\n");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
