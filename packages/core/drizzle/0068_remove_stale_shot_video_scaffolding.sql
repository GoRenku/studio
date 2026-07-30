PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__preserved_shot` AS
SELECT
	`id`,
	`shot_plan_id`,
	`position`,
	`title`,
	`description`,
	`brief`,
	`created_at`,
	`updated_at`,
	`discarded_at`,
	`discard_operation_id`,
	`restored_at`
FROM `shot`;--> statement-breakpoint
CREATE TABLE `__new_shot_plan` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`title` text NOT NULL,
	`coverage` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text
);
--> statement-breakpoint
INSERT INTO `__new_shot_plan`("id", "scene_id", "title", "coverage", "created_at", "updated_at", "discarded_at", "discard_operation_id", "restored_at") SELECT "id", "scene_id", "title", "coverage", "created_at", "updated_at", "discarded_at", "discard_operation_id", "restored_at" FROM `shot_plan`;--> statement-breakpoint
DROP TABLE `shot_plan`;--> statement-breakpoint
ALTER TABLE `__new_shot_plan` RENAME TO `shot_plan`;--> statement-breakpoint
INSERT INTO `shot` (
	`id`,
	`shot_plan_id`,
	`position`,
	`title`,
	`description`,
	`brief`,
	`created_at`,
	`updated_at`,
	`discarded_at`,
	`discard_operation_id`,
	`restored_at`
)
SELECT
	`id`,
	`shot_plan_id`,
	`position`,
	`title`,
	`description`,
	`brief`,
	`created_at`,
	`updated_at`,
	`discarded_at`,
	`discard_operation_id`,
	`restored_at`
FROM `__preserved_shot`;--> statement-breakpoint
DROP TABLE `__preserved_shot`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `shot_plan_scene_active_created_idx` ON `shot_plan` (`scene_id`,`discarded_at`,`created_at`,`id`);--> statement-breakpoint
PRAGMA user_version = 54;
