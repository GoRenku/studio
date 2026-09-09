ALTER TABLE `asset` ADD `previs_revision_id` text;--> statement-breakpoint
CREATE INDEX `asset_previs_revision_idx` ON `asset` (`previs_revision_id`);