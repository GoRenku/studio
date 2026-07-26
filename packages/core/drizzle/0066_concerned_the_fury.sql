CREATE TABLE `shot_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`shot_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`locale_id` text,
	`role` text NOT NULL,
	`reference_name` text,
	`purpose` text,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	FOREIGN KEY (`shot_id`) REFERENCES `shot`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`locale_id`) REFERENCES `project_locale`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `shot_asset_filter_order_idx` ON `shot_asset` (`shot_id`,`role`,`sort_order`,`asset_id`);--> statement-breakpoint
CREATE TABLE `shot_representative_display_asset` (
	`shot_id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`shot_id`) REFERENCES `shot`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `shot` ADD `title` text NOT NULL;--> statement-breakpoint
ALTER TABLE `shot` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `shot` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `shot` ADD `restored_at` text;--> statement-breakpoint
PRAGMA user_version = 52;
