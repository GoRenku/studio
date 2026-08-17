-- Drizzle Kit generated an Asset table rebuild for the direct schema cutover.
-- A populated project cannot drop that parent table inside Drizzle's migration
-- transaction while Asset files, memberships, and selections reference it.
-- Add, populate, and remove the scalar column in place instead.
ALTER TABLE `asset` ADD `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
UPDATE `asset` SET `tags` = CASE
	WHEN `purpose` IS NULL THEN json('[]')
	ELSE json_array(`purpose`)
END;--> statement-breakpoint
ALTER TABLE `asset` DROP COLUMN `purpose`;--> statement-breakpoint
PRAGMA user_version = 62;
