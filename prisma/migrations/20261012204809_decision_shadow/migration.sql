-- AlterTable
ALTER TABLE "decisions" ADD COLUMN     "shadow_action" "decision_action",
ADD COLUMN     "shadow_after" INTEGER,
ADD COLUMN     "shadow_reason" TEXT;
