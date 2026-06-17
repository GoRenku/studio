CREATE TABLE `scene_shot_video_take_generation_shot` (
	`take_generation_id` text NOT NULL,
	`shot_id` text NOT NULL,
	`shot_order` integer NOT NULL,
	`shot_content_fingerprint` text NOT NULL,
	`storyboard_image_id` text,
	`storyboard_asset_file_id` text,
	`storyboard_content_fingerprint` text NOT NULL,
	FOREIGN KEY (`take_generation_id`) REFERENCES `scene_shot_video_take_generation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scene_shot_video_take_generation_shot_idx` ON `scene_shot_video_take_generation_shot` (`take_generation_id`,`shot_id`);--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_generation_shot_order_idx` ON `scene_shot_video_take_generation_shot` (`take_generation_id`,`shot_order`);--> statement-breakpoint
CREATE TABLE `scene_shot_video_take_generation` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`shot_list_id` text NOT NULL,
	`title` text NOT NULL,
	`production_json` text NOT NULL,
	`compatibility_snapshot_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shot_list_id`) REFERENCES `scene_shot_list`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_generation_scene_idx` ON `scene_shot_video_take_generation` (`scene_id`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_generation_shot_list_idx` ON `scene_shot_video_take_generation` (`shot_list_id`,`created_at`,`id`);--> statement-breakpoint
DROP TABLE `scene_shot_video_take_input_shot`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_scene_shot_video_take_input` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`take_generation_id` text NOT NULL,
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
	FOREIGN KEY (`take_generation_id`) REFERENCES `scene_shot_video_take_generation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`media_generation_run_id`) REFERENCES `media_generation_run`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
DROP TABLE `scene_shot_video_take_input`;--> statement-breakpoint
ALTER TABLE `__new_scene_shot_video_take_input` RENAME TO `scene_shot_video_take_input`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_input_generation_idx` ON `scene_shot_video_take_input` (`scene_id`,`take_generation_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_input_asset_idx` ON `scene_shot_video_take_input` (`asset_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `scene_shot_video_take_input_selected_idx` ON `scene_shot_video_take_input` (`scene_id`,`take_generation_id`,`input_kind`,`subject_kind`,`subject_id`) WHERE "scene_shot_video_take_input"."selection" = 'select';--> statement-breakpoint
CREATE TABLE `__new_scene_shot_video_take` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`take_generation_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`asset_file_id` text NOT NULL,
	`media_generation_run_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`is_selected` integer NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`take_generation_id`) REFERENCES `scene_shot_video_take_generation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`media_generation_run_id`) REFERENCES `media_generation_run`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
DROP TABLE `scene_shot_video_take`;--> statement-breakpoint
ALTER TABLE `__new_scene_shot_video_take` RENAME TO `scene_shot_video_take`;--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_generation_idx` ON `scene_shot_video_take` (`scene_id`,`take_generation_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_asset_idx` ON `scene_shot_video_take` (`asset_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `scene_shot_video_take_selected_idx` ON `scene_shot_video_take` (`scene_id`,`take_generation_id`) WHERE "scene_shot_video_take"."is_selected" = 1;--> statement-breakpoint
PRAGMA user_version = 20;
