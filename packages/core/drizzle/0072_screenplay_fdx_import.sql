CREATE TABLE `screenplay_import` (
	`id` text PRIMARY KEY NOT NULL,
	`singleton_key` integer NOT NULL,
	`source_asset_id` text NOT NULL,
	`source_asset_file_id` text NOT NULL,
	`importer_version` integer NOT NULL,
	`imported_at` text NOT NULL,
	`technical_log_json` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`source_asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "screenplay_import_singleton_check" CHECK("screenplay_import"."singleton_key" = 1),
	CONSTRAINT "screenplay_import_version_check" CHECK("screenplay_import"."importer_version" = 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `screenplay_import_singleton_unique_idx` ON `screenplay_import` (`singleton_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `screenplay_import_source_file_unique_idx` ON `screenplay_import` (`source_asset_file_id`);--> statement-breakpoint
PRAGMA user_version = 58;
