CREATE TABLE `scene_shot_list_state` (
	`scene_id` text PRIMARY KEY NOT NULL,
	`active_shot_list_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`active_shot_list_id`) REFERENCES `scene_shot_list`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `scene_shot_list` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`title` text NOT NULL,
	`document` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scene_shot_list_scene_updated_idx` ON `scene_shot_list` (`scene_id`,`updated_at`,`id`);--> statement-breakpoint
CREATE TABLE `scene_shot_storyboard_image` (
	`id` text PRIMARY KEY NOT NULL,
	`storyboard_sheet_id` text NOT NULL,
	`shot_id` text NOT NULL,
	`asset_file_id` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`storyboard_sheet_id`) REFERENCES `scene_shot_storyboard_sheet`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scene_shot_storyboard_image_sheet_shot_idx` ON `scene_shot_storyboard_image` (`storyboard_sheet_id`,`shot_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `scene_shot_storyboard_image_file_idx` ON `scene_shot_storyboard_image` (`asset_file_id`);--> statement-breakpoint
CREATE INDEX `scene_shot_storyboard_image_order_idx` ON `scene_shot_storyboard_image` (`storyboard_sheet_id`,`position`,`id`);--> statement-breakpoint
CREATE TABLE `scene_shot_storyboard_sheet` (
	`id` text PRIMARY KEY NOT NULL,
	`shot_list_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`sheet_file_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`shot_list_id`) REFERENCES `scene_shot_list`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sheet_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scene_shot_storyboard_sheet_asset_idx` ON `scene_shot_storyboard_sheet` (`asset_id`);--> statement-breakpoint
CREATE INDEX `scene_shot_storyboard_sheet_list_created_idx` ON `scene_shot_storyboard_sheet` (`shot_list_id`,`created_at`,`id`);--> statement-breakpoint
PRAGMA user_version = 10;
