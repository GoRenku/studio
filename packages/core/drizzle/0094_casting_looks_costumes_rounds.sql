CREATE TABLE `cast_costume_scene` (
	`cast_member_id` text NOT NULL,
	`cast_costume_id` text NOT NULL,
	`scene_id` text NOT NULL,
	FOREIGN KEY (`cast_member_id`) REFERENCES `cast_member`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cast_costume_id`) REFERENCES `cast_costume`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cast_costume_scene_member_scene_idx` ON `cast_costume_scene` (`cast_member_id`,`scene_id`);--> statement-breakpoint
CREATE INDEX `cast_costume_scene_costume_idx` ON `cast_costume_scene` (`cast_costume_id`);--> statement-breakpoint
CREATE TABLE `cast_costume` (
	`id` text PRIMARY KEY NOT NULL,
	`cast_member_id` text NOT NULL,
	`cast_look_id` text NOT NULL,
	`name` text NOT NULL,
	`wardrobe_json` text NOT NULL,
	`continuity_notes_json` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`cast_member_id`) REFERENCES `cast_member`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cast_look_id`) REFERENCES `cast_look`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cast_costume_member_name_idx` ON `cast_costume` (`cast_member_id`,`name`);--> statement-breakpoint
CREATE INDEX `cast_costume_look_position_idx` ON `cast_costume` (`cast_look_id`,`position`);--> statement-breakpoint
CREATE TABLE `cast_look_scene` (
	`cast_member_id` text NOT NULL,
	`cast_look_id` text NOT NULL,
	`scene_id` text NOT NULL,
	FOREIGN KEY (`cast_member_id`) REFERENCES `cast_member`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cast_look_id`) REFERENCES `cast_look`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cast_look_scene_member_scene_idx` ON `cast_look_scene` (`cast_member_id`,`scene_id`);--> statement-breakpoint
CREATE INDEX `cast_look_scene_look_idx` ON `cast_look_scene` (`cast_look_id`);--> statement-breakpoint
CREATE TABLE `cast_look` (
	`id` text PRIMARY KEY NOT NULL,
	`cast_member_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`cast_member_id`) REFERENCES `cast_member`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cast_look_member_name_idx` ON `cast_look` (`cast_member_id`,`name`);--> statement-breakpoint
CREATE INDEX `cast_look_member_position_idx` ON `cast_look` (`cast_member_id`,`position`);--> statement-breakpoint
CREATE TABLE `casting_candidate` (
	`asset_file_id` text PRIMARY KEY NOT NULL,
	`casting_round_id` text NOT NULL,
	`status` text NOT NULL,
	`model_key` text NOT NULL,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`casting_round_id`) REFERENCES `casting_round`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `casting_candidate_round_idx` ON `casting_candidate` (`casting_round_id`);--> statement-breakpoint
CREATE TABLE `casting_round` (
	`id` text PRIMARY KEY NOT NULL,
	`cast_look_id` text NOT NULL,
	`number` integer NOT NULL,
	`routes_json` text NOT NULL,
	`max_concurrent_generations` integer NOT NULL,
	`reference_asset_file_ids_json` text NOT NULL,
	`estimated_cost_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`cast_look_id`) REFERENCES `cast_look`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `casting_round_look_number_idx` ON `casting_round` (`cast_look_id`,`number`);