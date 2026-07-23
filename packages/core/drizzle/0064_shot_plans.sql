CREATE TABLE `shot_plan` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`title` text NOT NULL,
	`coverage` text,
	`generation_spec_id` text,
	`video_asset_id` text,
	`video_attached_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	FOREIGN KEY (`generation_spec_id`) REFERENCES `media_generation_spec`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`video_asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "shot_plan_video_attachment_pair_check" CHECK(("shot_plan"."video_asset_id" is null and "shot_plan"."video_attached_at" is null) or ("shot_plan"."video_asset_id" is not null and "shot_plan"."video_attached_at" is not null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shot_plan_generation_spec_unique_idx` ON `shot_plan` (`generation_spec_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `shot_plan_video_asset_unique_idx` ON `shot_plan` (`video_asset_id`);--> statement-breakpoint
CREATE INDEX `shot_plan_scene_active_created_idx` ON `shot_plan` (`scene_id`,`discarded_at`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `shot` (
	`id` text PRIMARY KEY NOT NULL,
	`shot_plan_id` text NOT NULL,
	`position` integer NOT NULL,
	`description` text NOT NULL,
	`brief` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`shot_plan_id`) REFERENCES `shot_plan`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "shot_position_non_negative_check" CHECK("shot"."position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shot_plan_position_unique_idx` ON `shot` (`shot_plan_id`,`position`);--> statement-breakpoint
CREATE INDEX `shot_plan_id_idx` ON `shot` (`shot_plan_id`,`id`);--> statement-breakpoint
PRAGMA user_version = 50;
