-- CreateEnum
CREATE TYPE "run_status" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "campaign_state" AS ENUM ('ON', 'SUSPENDED');

-- CreateTable
CREATE TABLE "simulation_runs" (
    "id" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "current_tick" INTEGER NOT NULL DEFAULT 0,
    "status" "run_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "simulation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" "campaign_state" NOT NULL DEFAULT 'ON',
    "bid" INTEGER NOT NULL,
    "daily_budget" INTEGER NOT NULL,
    "target_cpo" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_truths" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "cr" DOUBLE PRECISION NOT NULL,
    "bid_sensitivity" DOUBLE PRECISION NOT NULL,
    "base_impressions" INTEGER NOT NULL,
    "reference_bid" INTEGER NOT NULL,
    "degrade_from_tick" INTEGER,
    "degraded_cr" DOUBLE PRECISION,

    CONSTRAINT "campaign_truths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tick_stats" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL,
    "orders" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,
    "bid" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tick_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaigns_run_id_idx" ON "campaigns"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_truths_campaign_id_key" ON "campaign_truths"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "tick_stats_campaign_id_tick_key" ON "tick_stats"("campaign_id", "tick");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "simulation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_truths" ADD CONSTRAINT "campaign_truths_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tick_stats" ADD CONSTRAINT "tick_stats_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
