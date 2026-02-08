import { PrismaClient } from "@prisma/client";
import { nflTeams } from "./seed-data/nfl-teams";
import { ncaafTeams } from "./seed-data/ncaaf-teams";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...\n");

  // ─── NFL Teams ──────────────────────────────────
  console.log("Seeding NFL teams...");

  // Idempotent: clear existing NFL teams and re-insert
  await prisma.team.deleteMany({ where: { sport: "NFL" } });

  const nflResult = await prisma.team.createMany({
    data: nflTeams,
  });

  console.log(`  ${nflResult.count} NFL teams seeded`);

  // Verify
  const nflByConf = await prisma.team.groupBy({
    by: ["conference"],
    where: { sport: "NFL" },
    _count: true,
  });
  for (const group of nflByConf) {
    console.log(`  ${group.conference}: ${group._count} teams`);
  }

  // ─── NCAAF Teams ────────────────────────────────
  console.log("\nSeeding NCAAF teams...");

  // Idempotent: clear existing NCAAF teams and re-insert
  await prisma.team.deleteMany({ where: { sport: "NCAAF" } });

  // Map NCAAF seed data to Prisma Team model
  const ncaafTeamData = ncaafTeams.map((t) => ({
    name: t.name,
    abbreviation: t.abbreviation,
    sport: t.sport,
    conference: t.conference2024,
    division: null,
    venue: t.venue,
    venueType: t.venueType,
    city: t.city,
    state: t.state,
    latitude: t.latitude,
    longitude: t.longitude,
  }));

  const ncaafResult = await prisma.team.createMany({
    data: ncaafTeamData,
  });

  console.log(`  ${ncaafResult.count} NCAAF teams seeded`);

  // Verify
  const ncaafByConf = await prisma.team.groupBy({
    by: ["conference"],
    where: { sport: "NCAAF" },
    _count: true,
  });
  for (const group of ncaafByConf) {
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
