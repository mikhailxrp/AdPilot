-- CreateEnum
CREATE TYPE "agent_engine" AS ENUM ('RULES', 'LLM');

-- CreateEnum
CREATE TYPE "decision_action" AS ENUM ('WAIT_DATA', 'HOLD', 'LOWER_BID', 'RAISE_BID', 'RAISE_BUDGET', 'PAUSE');

-- CreateEnum
CREATE TYPE "decision_verdict" AS ENUM ('ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "agent_configs" (
    "id" TEXT NOT NULL,
    "engine" "agent_engine" NOT NULL,
    "dry_run" BOOLEAN NOT NULL,
    "timer_enabled" BOOLEAN NOT NULL,
    "tick_interval_sec" INTEGER NOT NULL,
    "min_clicks" INTEGER NOT NULL,
    "max_step_pct" INTEGER NOT NULL,
    "max_daily_budget" INTEGER NOT NULL,
    "cooldown_ticks" INTEGER NOT NULL,
    "cpo_tolerance_pct" INTEGER NOT NULL,
    "window_ticks" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "engine" "agent_engine" NOT NULL,
    "action" "decision_action" NOT NULL,
    "before" INTEGER,
    "after" INTEGER,
    "reason" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "dry_run" BOOLEAN NOT NULL,
    "verdict" "decision_verdict" NOT NULL,
    "reject_reason" TEXT,
    "raw_response" TEXT,
    "apply_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "decisions_run_id_tick_idx" ON "decisions"("run_id", "tick");

-- CreateIndex
CREATE INDEX "decisions_campaign_id_idx" ON "decisions"("campaign_id");

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "simulation_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
