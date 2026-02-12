-- TrendLine initial migration baseline
-- Generated from prisma/schema.prisma on 2026-02-12
-- Apply with: prisma migrate resolve --applied 0_init

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Sport" AS ENUM ('NFL', 'NCAAF', 'NCAAMB');

-- CreateEnum
CREATE TYPE "VenueType" AS ENUM ('OUTDOOR', 'DOME', 'RETRACTABLE');

-- CreateEnum
CREATE TYPE "SpreadResult" AS ENUM ('COVERED', 'LOST', 'PUSH');

-- CreateEnum
CREATE TYPE "OUResult" AS ENUM ('OVER', 'UNDER', 'PUSH');

-- CreateEnum
CREATE TYPE "WeatherCategory" AS ENUM ('CLEAR', 'CLOUDY', 'RAIN', 'SNOW', 'WIND', 'FOG', 'DOME', 'RETRACTABLE_CLOSED', 'RETRACTABLE_OPEN');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('FREE', 'PREMIUM', 'ADMIN');

-- CreateEnum
CREATE TYPE "BetType" AS ENUM ('SPREAD', 'OVER_UNDER', 'MONEYLINE', 'PLAYER_PROP', 'PARLAY', 'TEASER');

-- CreateEnum
CREATE TYPE "BetResult" AS ENUM ('WIN', 'LOSS', 'PUSH', 'PENDING');

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "conference" TEXT NOT NULL,
    "division" TEXT,
    "venue" TEXT,
    "venueType" "VenueType" NOT NULL DEFAULT 'OUTDOOR',
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NFLGame" (
    "id" SERIAL NOT NULL,
    "season" INTEGER NOT NULL,
    "week" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "gameDate" TIMESTAMP(3) NOT NULL,
    "kickoffTime" TEXT,
    "homeTeamId" INTEGER NOT NULL,
    "awayTeamId" INTEGER NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "scoreDifference" INTEGER,
    "winnerId" INTEGER,
    "isPrimetime" BOOLEAN NOT NULL DEFAULT false,
    "primetimeSlot" TEXT,
    "temperature" DOUBLE PRECISION,
    "windMph" DOUBLE PRECISION,
    "weatherCategory" "WeatherCategory",
    "weatherRaw" TEXT,
    "spread" DOUBLE PRECISION,
    "overUnder" DOUBLE PRECISION,
    "spreadResult" "SpreadResult",
    "ouResult" "OUResult",
    "isPlayoff" BOOLEAN NOT NULL DEFAULT false,
    "isNeutralSite" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NFLGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NCAAFGame" (
    "id" SERIAL NOT NULL,
    "season" INTEGER NOT NULL,
    "week" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "gameDate" TIMESTAMP(3) NOT NULL,
    "kickoffTime" TEXT,
    "homeTeamId" INTEGER NOT NULL,
    "awayTeamId" INTEGER NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "scoreDifference" INTEGER,
    "winnerId" INTEGER,
    "homeRank" INTEGER,
    "awayRank" INTEGER,
    "isConferenceGame" BOOLEAN NOT NULL DEFAULT false,
    "isBowlGame" BOOLEAN NOT NULL DEFAULT false,
    "bowlName" TEXT,
    "isPrimetime" BOOLEAN NOT NULL DEFAULT false,
    "primetimeSlot" TEXT,
    "temperature" DOUBLE PRECISION,
    "windMph" DOUBLE PRECISION,
    "weatherCategory" "WeatherCategory",
    "weatherRaw" TEXT,
    "spread" DOUBLE PRECISION,
    "overUnder" DOUBLE PRECISION,
    "spreadResult" "SpreadResult",
    "ouResult" "OUResult",
    "isPlayoff" BOOLEAN NOT NULL DEFAULT false,
    "isNeutralSite" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NCAAFGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NCAAMBGame" (
    "id" SERIAL NOT NULL,
    "season" INTEGER NOT NULL,
    "gameDate" TIMESTAMP(3) NOT NULL,
    "tipoffTime" TEXT,
    "homeTeamId" INTEGER NOT NULL,
    "awayTeamId" INTEGER NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "scoreDifference" INTEGER,
    "winnerId" INTEGER,
    "homeRank" INTEGER,
    "awayRank" INTEGER,
    "homeSeed" INTEGER,
    "awaySeed" INTEGER,
    "isConferenceGame" BOOLEAN NOT NULL DEFAULT false,
    "isNeutralSite" BOOLEAN NOT NULL DEFAULT false,
    "isTournament" BOOLEAN NOT NULL DEFAULT false,
    "tournamentRound" TEXT,
    "tournamentRegion" TEXT,
    "isNIT" BOOLEAN NOT NULL DEFAULT false,
    "isConferenceTourney" BOOLEAN NOT NULL DEFAULT false,
    "homeKenpomRank" INTEGER,
    "awayKenpomRank" INTEGER,
    "homeAdjEM" DOUBLE PRECISION,
    "awayAdjEM" DOUBLE PRECISION,
    "homeAdjOE" DOUBLE PRECISION,
    "awayAdjOE" DOUBLE PRECISION,
    "homeAdjDE" DOUBLE PRECISION,
    "awayAdjDE" DOUBLE PRECISION,
    "homeAdjTempo" DOUBLE PRECISION,
    "awayAdjTempo" DOUBLE PRECISION,
    "fmHomePred" DOUBLE PRECISION,
    "fmAwayPred" DOUBLE PRECISION,
    "fmHomeWinProb" DOUBLE PRECISION,
    "fmThrillScore" DOUBLE PRECISION,
    "spread" DOUBLE PRECISION,
    "overUnder" DOUBLE PRECISION,
    "moneylineHome" INTEGER,
    "moneylineAway" INTEGER,
    "spreadResult" "SpreadResult",
    "ouResult" "OUResult",
    "overtimes" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NCAAMBGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpcomingGame" (
    "id" SERIAL NOT NULL,
    "sport" "Sport" NOT NULL,
    "gameDate" TIMESTAMP(3) NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "homeRank" INTEGER,
    "awayRank" INTEGER,
    "spread" DOUBLE PRECISION,
    "overUnder" DOUBLE PRECISION,
    "moneylineHome" INTEGER,
    "moneylineAway" INTEGER,
    "forecastTemp" DOUBLE PRECISION,
    "forecastWindMph" DOUBLE PRECISION,
    "forecastCategory" "WeatherCategory",
    "forecastUpdated" TIMESTAMP(3),
    "fmHomePred" DOUBLE PRECISION,
    "fmAwayPred" DOUBLE PRECISION,
    "fmHomeWinProb" DOUBLE PRECISION,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UpcomingGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OddsSnapshot" (
    "id" SERIAL NOT NULL,
    "sport" "Sport" NOT NULL,
    "gameDate" TIMESTAMP(3) NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "bookmakers" JSONB NOT NULL,
    "bestSpread" DOUBLE PRECISION,
    "bestTotal" DOUBLE PRECISION,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OddsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedTrend" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "query" JSONB NOT NULL,
    "description" TEXT,
    "lastResult" JSONB,
    "lastTriggered" TIMESTAMP(3),
    "notifyEmail" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedTrend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "password" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'FREE',
    "stripeCustomerId" TEXT,
    "subscriptionId" TEXT,
    "subscriptionStatus" TEXT,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "SearchLog" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "sport" "Sport",
    "filters" TEXT,
    "results" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerGameLog" (
    "id" SERIAL NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "positionGroup" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "seasonType" TEXT NOT NULL DEFAULT 'REG',
    "team" TEXT NOT NULL,
    "opponentTeam" TEXT NOT NULL,
    "gameDate" TIMESTAMP(3),
    "isHome" BOOLEAN,
    "teamScore" INTEGER,
    "opponentScore" INTEGER,
    "gameResult" TEXT,
    "spread" DOUBLE PRECISION,
    "overUnder" DOUBLE PRECISION,
    "spreadResult" TEXT,
    "ouResult" TEXT,
    "isPlayoff" BOOLEAN NOT NULL DEFAULT false,
    "isPrimetime" BOOLEAN,
    "stats" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "PlayerGameLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "betType" "BetType" NOT NULL,
    "gameDate" TIMESTAMP(3) NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "pickSide" TEXT NOT NULL,
    "line" DOUBLE PRECISION,
    "oddsValue" INTEGER NOT NULL DEFAULT -110,
    "stake" DOUBLE PRECISION NOT NULL,
    "toWin" DOUBLE PRECISION NOT NULL,
    "result" "BetResult" NOT NULL DEFAULT 'PENDING',
    "profit" DOUBLE PRECISION,
    "sportsbook" TEXT,
    "playerName" TEXT,
    "propStat" TEXT,
    "propLine" DOUBLE PRECISION,
    "notes" TEXT,
    "parlayLegs" JSONB,
    "teaserPoints" DOUBLE PRECISION,
    "dailyPickId" INTEGER,
    "gradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyPick" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "sport" "Sport" NOT NULL,
    "pickType" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "gameDate" TIMESTAMP(3) NOT NULL,
    "pickSide" TEXT NOT NULL,
    "line" DOUBLE PRECISION,
    "pickLabel" TEXT NOT NULL,
    "playerName" TEXT,
    "propStat" TEXT,
    "propLine" DOUBLE PRECISION,
    "trendScore" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "headline" TEXT NOT NULL,
    "reasoning" JSONB NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "actualValue" DOUBLE PRECISION,
    "gradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Team_sport_idx" ON "Team"("sport");

-- CreateIndex
CREATE INDEX "Team_sport_conference_idx" ON "Team"("sport", "conference");

-- CreateIndex
CREATE UNIQUE INDEX "Team_sport_name_key" ON "Team"("sport", "name");

-- CreateIndex
CREATE INDEX "NFLGame_season_week_idx" ON "NFLGame"("season", "week");

-- CreateIndex
CREATE INDEX "NFLGame_homeTeamId_idx" ON "NFLGame"("homeTeamId");

-- CreateIndex
CREATE INDEX "NFLGame_awayTeamId_idx" ON "NFLGame"("awayTeamId");

-- CreateIndex
CREATE INDEX "NFLGame_gameDate_idx" ON "NFLGame"("gameDate");

-- CreateIndex
CREATE INDEX "NFLGame_isPrimetime_idx" ON "NFLGame"("isPrimetime");

-- CreateIndex
CREATE INDEX "NFLGame_spread_idx" ON "NFLGame"("spread");

-- CreateIndex
CREATE INDEX "NFLGame_weatherCategory_idx" ON "NFLGame"("weatherCategory");

-- CreateIndex
CREATE INDEX "NFLGame_isPlayoff_idx" ON "NFLGame"("isPlayoff");

-- CreateIndex
CREATE INDEX "NFLGame_isPrimetime_spread_idx" ON "NFLGame"("isPrimetime", "spread");

-- CreateIndex
CREATE INDEX "NFLGame_weatherCategory_spread_idx" ON "NFLGame"("weatherCategory", "spread");

-- CreateIndex
CREATE INDEX "NFLGame_dayOfWeek_spread_idx" ON "NFLGame"("dayOfWeek", "spread");

-- CreateIndex
CREATE INDEX "NFLGame_isPlayoff_spread_idx" ON "NFLGame"("isPlayoff", "spread");

-- CreateIndex
CREATE INDEX "NFLGame_season_homeTeamId_spread_idx" ON "NFLGame"("season", "homeTeamId", "spread");

-- CreateIndex
CREATE INDEX "NFLGame_awayTeamId_season_idx" ON "NFLGame"("awayTeamId", "season");

-- CreateIndex
CREATE UNIQUE INDEX "NFLGame_gameDate_homeTeamId_awayTeamId_key" ON "NFLGame"("gameDate", "homeTeamId", "awayTeamId");

-- CreateIndex
CREATE INDEX "NCAAFGame_season_week_idx" ON "NCAAFGame"("season", "week");

-- CreateIndex
CREATE INDEX "NCAAFGame_homeTeamId_idx" ON "NCAAFGame"("homeTeamId");

-- CreateIndex
CREATE INDEX "NCAAFGame_awayTeamId_idx" ON "NCAAFGame"("awayTeamId");

-- CreateIndex
CREATE INDEX "NCAAFGame_gameDate_idx" ON "NCAAFGame"("gameDate");

-- CreateIndex
CREATE INDEX "NCAAFGame_spread_idx" ON "NCAAFGame"("spread");

-- CreateIndex
CREATE INDEX "NCAAFGame_isConferenceGame_idx" ON "NCAAFGame"("isConferenceGame");

-- CreateIndex
CREATE INDEX "NCAAFGame_isBowlGame_idx" ON "NCAAFGame"("isBowlGame");

-- CreateIndex
CREATE INDEX "NCAAFGame_homeRank_idx" ON "NCAAFGame"("homeRank");

-- CreateIndex
CREATE INDEX "NCAAFGame_awayRank_idx" ON "NCAAFGame"("awayRank");

-- CreateIndex
CREATE INDEX "NCAAFGame_weatherCategory_spread_idx" ON "NCAAFGame"("weatherCategory", "spread");

-- CreateIndex
CREATE INDEX "NCAAFGame_season_homeTeamId_spread_idx" ON "NCAAFGame"("season", "homeTeamId", "spread");

-- CreateIndex
CREATE INDEX "NCAAFGame_homeTeamId_season_idx" ON "NCAAFGame"("homeTeamId", "season");

-- CreateIndex
CREATE INDEX "NCAAFGame_awayTeamId_season_idx" ON "NCAAFGame"("awayTeamId", "season");

-- CreateIndex
CREATE UNIQUE INDEX "NCAAFGame_gameDate_homeTeamId_awayTeamId_key" ON "NCAAFGame"("gameDate", "homeTeamId", "awayTeamId");

-- CreateIndex
CREATE INDEX "NCAAMBGame_season_idx" ON "NCAAMBGame"("season");

-- CreateIndex
CREATE INDEX "NCAAMBGame_homeTeamId_idx" ON "NCAAMBGame"("homeTeamId");

-- CreateIndex
CREATE INDEX "NCAAMBGame_awayTeamId_idx" ON "NCAAMBGame"("awayTeamId");

-- CreateIndex
CREATE INDEX "NCAAMBGame_gameDate_idx" ON "NCAAMBGame"("gameDate");

-- CreateIndex
CREATE INDEX "NCAAMBGame_spread_idx" ON "NCAAMBGame"("spread");

-- CreateIndex
CREATE INDEX "NCAAMBGame_isTournament_idx" ON "NCAAMBGame"("isTournament");

-- CreateIndex
CREATE INDEX "NCAAMBGame_isTournament_tournamentRound_idx" ON "NCAAMBGame"("isTournament", "tournamentRound");

-- CreateIndex
CREATE INDEX "NCAAMBGame_isConferenceGame_idx" ON "NCAAMBGame"("isConferenceGame");

-- CreateIndex
CREATE INDEX "NCAAMBGame_season_homeTeamId_spread_idx" ON "NCAAMBGame"("season", "homeTeamId", "spread");

-- CreateIndex
CREATE INDEX "NCAAMBGame_homeTeamId_season_idx" ON "NCAAMBGame"("homeTeamId", "season");

-- CreateIndex
CREATE INDEX "NCAAMBGame_awayTeamId_season_idx" ON "NCAAMBGame"("awayTeamId", "season");

-- CreateIndex
CREATE UNIQUE INDEX "NCAAMBGame_gameDate_homeTeamId_awayTeamId_key" ON "NCAAMBGame"("gameDate", "homeTeamId", "awayTeamId");

-- CreateIndex
CREATE INDEX "UpcomingGame_sport_gameDate_idx" ON "UpcomingGame"("sport", "gameDate");

-- CreateIndex
CREATE UNIQUE INDEX "UpcomingGame_sport_gameDate_homeTeam_awayTeam_key" ON "UpcomingGame"("sport", "gameDate", "homeTeam", "awayTeam");

-- CreateIndex
CREATE INDEX "OddsSnapshot_sport_gameDate_idx" ON "OddsSnapshot"("sport", "gameDate");

-- CreateIndex
CREATE INDEX "OddsSnapshot_homeTeam_awayTeam_gameDate_idx" ON "OddsSnapshot"("homeTeam", "awayTeam", "gameDate");

-- CreateIndex
CREATE INDEX "OddsSnapshot_sport_homeTeam_awayTeam_fetchedAt_idx" ON "OddsSnapshot"("sport", "homeTeam", "awayTeam", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OddsSnapshot_externalId_fetchedAt_key" ON "OddsSnapshot"("externalId", "fetchedAt");

-- CreateIndex
CREATE INDEX "SavedTrend_userId_idx" ON "SavedTrend"("userId");

-- CreateIndex
CREATE INDEX "SavedTrend_sport_idx" ON "SavedTrend"("sport");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "SearchLog_userId_idx" ON "SearchLog"("userId");

-- CreateIndex
CREATE INDEX "SearchLog_createdAt_idx" ON "SearchLog"("createdAt");

-- CreateIndex
CREATE INDEX "PlayerGameLog_playerId_season_idx" ON "PlayerGameLog"("playerId", "season");

-- CreateIndex
CREATE INDEX "PlayerGameLog_playerName_idx" ON "PlayerGameLog"("playerName");

-- CreateIndex
CREATE INDEX "PlayerGameLog_team_season_idx" ON "PlayerGameLog"("team", "season");

-- CreateIndex
CREATE INDEX "PlayerGameLog_season_positionGroup_idx" ON "PlayerGameLog"("season", "positionGroup");

-- CreateIndex
CREATE INDEX "PlayerGameLog_playerId_idx" ON "PlayerGameLog"("playerId");

-- CreateIndex
CREATE INDEX "Bet_userId_idx" ON "Bet"("userId");

-- CreateIndex
CREATE INDEX "Bet_userId_result_idx" ON "Bet"("userId", "result");

-- CreateIndex
CREATE INDEX "Bet_userId_sport_idx" ON "Bet"("userId", "sport");

-- CreateIndex
CREATE INDEX "Bet_userId_gameDate_idx" ON "Bet"("userId", "gameDate");

-- CreateIndex
CREATE INDEX "Bet_userId_createdAt_idx" ON "Bet"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Bet_gameDate_homeTeam_awayTeam_idx" ON "Bet"("gameDate", "homeTeam", "awayTeam");

-- CreateIndex
CREATE INDEX "Bet_result_idx" ON "Bet"("result");

-- CreateIndex
CREATE INDEX "DailyPick_date_sport_idx" ON "DailyPick"("date", "sport");

-- CreateIndex
CREATE INDEX "DailyPick_result_idx" ON "DailyPick"("result");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPick_date_sport_homeTeam_awayTeam_pickType_pickSide_pl_key" ON "DailyPick"("date", "sport", "homeTeam", "awayTeam", "pickType", "pickSide", "playerName");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- AddForeignKey
ALTER TABLE "NFLGame" ADD CONSTRAINT "NFLGame_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NFLGame" ADD CONSTRAINT "NFLGame_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NFLGame" ADD CONSTRAINT "NFLGame_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NCAAFGame" ADD CONSTRAINT "NCAAFGame_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NCAAFGame" ADD CONSTRAINT "NCAAFGame_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NCAAFGame" ADD CONSTRAINT "NCAAFGame_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NCAAMBGame" ADD CONSTRAINT "NCAAMBGame_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NCAAMBGame" ADD CONSTRAINT "NCAAMBGame_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NCAAMBGame" ADD CONSTRAINT "NCAAMBGame_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedTrend" ADD CONSTRAINT "SavedTrend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchLog" ADD CONSTRAINT "SearchLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

