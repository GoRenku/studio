CREATE TABLE `cast_voice` (
	`id` text PRIMARY KEY NOT NULL,
	`cast_member_id` text NOT NULL,
	`name` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`voice_id` text NOT NULL,
	`purpose` text NOT NULL,
	`sample_asset_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`cast_member_id`) REFERENCES `cast_member`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sample_asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cast_voice_cast_order_idx` ON `cast_voice` (`cast_member_id`,`sort_order`,`id`);--> statement-breakpoint
CREATE INDEX `cast_voice_provider_model_voice_idx` ON `cast_voice` (`provider`,`model`,`voice_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `cast_voice_sample_asset_idx` ON `cast_voice` (`sample_asset_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `cast_voice_cast_name_idx` ON `cast_voice` (`cast_member_id`,`name`);--> statement-breakpoint
ALTER TABLE `cast_asset` ADD `reference_name` text;--> statement-breakpoint
ALTER TABLE `cast_asset` ADD `purpose` text;--> statement-breakpoint
ALTER TABLE `location_asset` ADD `reference_name` text;--> statement-breakpoint
ALTER TABLE `location_asset` ADD `purpose` text;--> statement-breakpoint
ALTER TABLE `project_asset` ADD `reference_name` text;--> statement-breakpoint
ALTER TABLE `project_asset` ADD `purpose` text;--> statement-breakpoint
ALTER TABLE `scene_asset` ADD `reference_name` text;--> statement-breakpoint
ALTER TABLE `scene_asset` ADD `purpose` text;--> statement-breakpoint
ALTER TABLE `sequence_asset` ADD `reference_name` text;--> statement-breakpoint
ALTER TABLE `sequence_asset` ADD `purpose` text;--> statement-breakpoint
PRAGMA user_version = 15;
