/**
 * Pipeline Orchestrator
 *
 * Coordinates all data pipeline operations:
 * - Score scraping
 * - Spread data collection
 * - Weather data fetching
 * - Data normalization & processing
 * - Validation
 * - Database import
 *
 * Can be run in full or by individual stage.
 *
 * Usage:
 *   npx ts-node scripts/pipeline.ts [stage] [sport] [--dry-run]
 *
 * Stages: scrape-scores | scrape-spreads | fetch-weather | process | validate | import | all
 * Sports: nfl | ncaaf | ncaamb | all
 */

import { createLogger } from "./utils/logger";

const log = createLogger("pipeline");

type Stage =
  | "scrape-scores"
  | "scrape-spreads"
  | "fetch-weather"
  | "process"
  | "validate"
  | "import"
  | "all";

type Sport = "nfl" | "ncaaf" | "ncaamb" | "all";

interface PipelineOptions {
  stage: Stage;
  sport: Sport;
  dryRun: boolean;
}

function parseArgs(): PipelineOptions {
  const args = process.argv.slice(2);
  return {
    stage: (args[0] as Stage) || "all",
    sport: (args[1] as Sport) || "all",
    dryRun: args.includes("--dry-run"),
  };
}

async function runPipeline(options: PipelineOptions): Promise<void> {
  const { stage, sport, dryRun } = options;

  log.info("Pipeline starting", { stage, sport, dryRun });

  if (dryRun) {
    log.info("DRY RUN — no data will be written");
  }

  const startTime = Date.now();

  try {
    // Stage execution will be implemented as each phase builds out
    switch (stage) {
      case "scrape-scores":
        log.info("Score scraping stage");
        break;
      case "scrape-spreads":
        log.info("Spread scraping stage");
        break;
      case "fetch-weather":
        log.info("Weather fetching stage");
        break;
      case "process":
        log.info("Processing stage");
        break;
      case "validate":
        log.info("Validation stage");
        break;
      case "import":
        log.info("Import stage");
        break;
      case "all":
        log.info("Running all stages");
        break;
      default:
        log.error(`Unknown stage: ${stage}`);
        process.exit(1);
    }

    const elapsed = Date.now() - startTime;
    log.info("Pipeline completed", { elapsedMs: elapsed });
  } catch (error) {
    log.error("Pipeline failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Run
const options = parseArgs();
runPipeline(options);
