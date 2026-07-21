CREATE TABLE `scene_production_number` (
	`production_number` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scene_production_number_scene_id_unique` ON `scene_production_number` (`scene_id`);