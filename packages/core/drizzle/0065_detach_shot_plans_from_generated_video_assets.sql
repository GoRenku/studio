PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_shot_plan` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`title` text NOT NULL,
	`coverage` text,
	`generation_spec_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	FOREIGN KEY (`generation_spec_id`) REFERENCES `media_generation_spec`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_shot_plan`("id", "scene_id", "title", "coverage", "generation_spec_id", "created_at", "updated_at", "discarded_at", "discard_operation_id", "restored_at") SELECT "id", "scene_id", "title", "coverage", "generation_spec_id", "created_at", "updated_at", "discarded_at", "discard_operation_id", "restored_at" FROM `shot_plan`;--> statement-breakpoint
DROP TABLE `shot_plan`;--> statement-breakpoint
ALTER TABLE `__new_shot_plan` RENAME TO `shot_plan`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `shot_plan_last_generation_spec_unique_idx` ON `shot_plan` (`generation_spec_id`);--> statement-breakpoint
CREATE INDEX `shot_plan_scene_active_created_idx` ON `shot_plan` (`scene_id`,`discarded_at`,`created_at`,`id`);--> statement-breakpoint
ALTER TABLE `media_generation_spec` ADD `authored_from_shot_plan_id` text;--> statement-breakpoint
CREATE INDEX `media_generation_spec_authored_from_idx` ON `media_generation_spec` (`purpose`,`authored_from_shot_plan_id`,`created_at`,`id`);--> statement-breakpoint
PRAGMA user_version = 51;
