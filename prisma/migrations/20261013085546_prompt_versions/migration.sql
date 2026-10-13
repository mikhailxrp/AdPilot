-- AlterTable
ALTER TABLE "agent_configs" ADD COLUMN     "llm_model_uri" TEXT,
ADD COLUMN     "llm_system_prompt" TEXT,
ADD COLUMN     "llm_temperature" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "decisions" ADD COLUMN     "prompt_version_id" TEXT;

-- CreateTable
CREATE TABLE "prompt_versions" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prompt_versions_sha256_key" ON "prompt_versions"("sha256");

-- CreateIndex
CREATE INDEX "decisions_prompt_version_id_idx" ON "decisions"("prompt_version_id");

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "prompt_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
