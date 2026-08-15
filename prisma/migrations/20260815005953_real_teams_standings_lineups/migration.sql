-- AlterTable
ALTER TABLE "Fixture" ADD COLUMN     "awayLogo" TEXT,
ADD COLUMN     "homeLogo" TEXT,
ADD COLUMN     "lineups" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "League" ADD COLUMN     "standings" JSONB NOT NULL DEFAULT '[]';
