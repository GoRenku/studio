CREATE TABLE `shot_plan_clip_take` (
	`id` text PRIMARY KEY NOT NULL,
	`clip_id` text NOT NULL,
	`number` integer NOT NULL,
	`title` text,
	`asset_id` text NOT NULL,
	`asset_file_id` text NOT NULL,
	`source_take_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`clip_id`) REFERENCES `shot_plan_clip`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_take_id`) REFERENCES `shot_plan_clip_take`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shot_plan_clip_take_number_idx` ON `shot_plan_clip_take` (`clip_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `shot_plan_clip_take_file_idx` ON `shot_plan_clip_take` (`asset_file_id`);--> statement-breakpoint
CREATE TABLE `shot_plan_clip` (
	`id` text PRIMARY KEY NOT NULL,
	`previs_revision_id` text NOT NULL,
	`number` integer NOT NULL,
	`selected_take_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`previs_revision_id`) REFERENCES `shot_plan_previs_revision`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`selected_take_id`) REFERENCES `shot_plan_clip_take`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shot_plan_clip_number_idx` ON `shot_plan_clip` (`previs_revision_id`,`number`);
--> statement-breakpoint
PRAGMA user_version = 70;
