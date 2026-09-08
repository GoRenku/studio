CREATE TABLE `shot_plan_previs_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`shot_plan_id` text NOT NULL,
	`number` integer NOT NULL,
	`source_directory` text NOT NULL,
	`source_hash` text NOT NULL,
	`render_hash` text NOT NULL,
	`asset_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`shot_plan_id`) REFERENCES `shot_plan`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shot_plan_previs_number_idx` ON `shot_plan_previs_revision` (`shot_plan_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `shot_plan_previs_content_idx` ON `shot_plan_previs_revision` (`shot_plan_id`,`source_hash`,`render_hash`);--> statement-breakpoint
ALTER TABLE `shot_plan` ADD `type` text DEFAULT 'shot-list' NOT NULL;