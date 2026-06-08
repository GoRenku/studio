CREATE TABLE `cast_design_state` (
	`cast_member_id` text PRIMARY KEY NOT NULL,
	`active_design_id` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`cast_member_id`) REFERENCES `cast_member`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`active_design_id`) REFERENCES `cast_design`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cast_design_state_active_idx` ON `cast_design_state` (`active_design_id`);--> statement-breakpoint
CREATE TABLE `cast_design` (
	`id` text PRIMARY KEY NOT NULL,
	`cast_member_id` text NOT NULL,
	`document_json` text NOT NULL,
	`title` text,
	`source_command` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`cast_member_id`) REFERENCES `cast_member`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cast_design_owner_created_idx` ON `cast_design` (`cast_member_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `location_design_state` (
	`location_id` text PRIMARY KEY NOT NULL,
	`active_design_id` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`active_design_id`) REFERENCES `location_design`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `location_design_state_active_idx` ON `location_design_state` (`active_design_id`);--> statement-breakpoint
CREATE TABLE `location_design` (
	`id` text PRIMARY KEY NOT NULL,
	`location_id` text NOT NULL,
	`document_json` text NOT NULL,
	`title` text,
	`source_command` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `location_design_owner_created_idx` ON `location_design` (`location_id`,`created_at`,`id`);