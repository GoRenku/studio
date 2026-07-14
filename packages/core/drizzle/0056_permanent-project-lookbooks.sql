DROP INDEX `lookbook_current_kind_unique_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `lookbook_kind_unique_idx` ON `lookbook` (`kind`);--> statement-breakpoint
ALTER TABLE `lookbook` DROP COLUMN `discarded_at`;--> statement-breakpoint
ALTER TABLE `lookbook` DROP COLUMN `discard_operation_id`;--> statement-breakpoint
ALTER TABLE `lookbook` DROP COLUMN `restored_at`;--> statement-breakpoint
PRAGMA user_version = 44;
