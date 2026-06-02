PRAGMA user_version = 13;--> statement-breakpoint

CREATE TABLE `scene_shot_video_take_input_shot` (
	`input_id` text NOT NULL,
	`shot_id` text NOT NULL,
	`shot_order` integer NOT NULL,
	FOREIGN KEY (`input_id`) REFERENCES `scene_shot_video_take_input`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scene_shot_video_take_input_shot_idx` ON `scene_shot_video_take_input_shot` (`input_id`,`shot_id`);--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_input_shot_order_idx` ON `scene_shot_video_take_input_shot` (`input_id`,`shot_order`);--> statement-breakpoint
CREATE TABLE `scene_shot_video_take_input` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`shot_list_id` text NOT NULL,
	`production_group_id` text NOT NULL,
	`input_kind` text NOT NULL,
	`subject_kind` text NOT NULL,
	`subject_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`asset_file_id` text NOT NULL,
	`media_generation_run_id` text,
	`selection` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shot_list_id`) REFERENCES `scene_shot_list`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`media_generation_run_id`) REFERENCES `media_generation_run`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_input_group_idx` ON `scene_shot_video_take_input` (`scene_id`,`shot_list_id`,`production_group_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_input_asset_idx` ON `scene_shot_video_take_input` (`asset_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `scene_shot_video_take_input_selected_idx` ON `scene_shot_video_take_input` (`scene_id`,`shot_list_id`,`production_group_id`,`input_kind`,`subject_kind`,`subject_id`) WHERE "scene_shot_video_take_input"."selection" = 'select';--> statement-breakpoint
CREATE TABLE `scene_shot_video_take_shot` (
	`take_id` text NOT NULL,
	`shot_id` text NOT NULL,
	`shot_order` integer NOT NULL,
	FOREIGN KEY (`take_id`) REFERENCES `scene_shot_video_take`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scene_shot_video_take_shot_idx` ON `scene_shot_video_take_shot` (`take_id`,`shot_id`);--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_shot_order_idx` ON `scene_shot_video_take_shot` (`take_id`,`shot_order`);--> statement-breakpoint
CREATE TABLE `scene_shot_video_take` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`shot_list_id` text NOT NULL,
	`production_group_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`asset_file_id` text NOT NULL,
	`media_generation_run_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`is_selected` integer NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shot_list_id`) REFERENCES `scene_shot_list`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`media_generation_run_id`) REFERENCES `media_generation_run`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_group_idx` ON `scene_shot_video_take` (`scene_id`,`shot_list_id`,`production_group_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_asset_idx` ON `scene_shot_video_take` (`asset_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `scene_shot_video_take_selected_idx` ON `scene_shot_video_take` (`scene_id`,`shot_list_id`,`production_group_id`) WHERE "scene_shot_video_take"."is_selected" = 1;
