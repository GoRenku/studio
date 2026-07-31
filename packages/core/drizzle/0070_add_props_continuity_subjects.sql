CREATE TABLE `prop_design_state` (
	`prop_id` text PRIMARY KEY NOT NULL,
	`active_design_id` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`prop_id`) REFERENCES `prop`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`active_design_id`) REFERENCES `prop_design`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prop_design_state_active_idx` ON `prop_design_state` (`active_design_id`);--> statement-breakpoint
CREATE TABLE `prop_design` (
	`id` text PRIMARY KEY NOT NULL,
	`prop_id` text NOT NULL,
	`document_json` text NOT NULL,
	`title` text,
	`source_command` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`prop_id`) REFERENCES `prop`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `prop_design_owner_created_idx` ON `prop_design` (`prop_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `prop` (
	`id` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`visual_notes` text,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `prop_position_id_idx` ON `prop` (`position`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `prop_handle_idx` ON `prop` (`handle`);--> statement-breakpoint
-- Location Design previously used a broad local-object name. Guard the
-- one-way JSON conversion so malformed or ambiguous documents abort the
-- Drizzle transaction before any document is rewritten.
CREATE TEMP TABLE `_location_recurring_object_conversion_guard` (
	`valid` integer NOT NULL CHECK (`valid` = 1)
);--> statement-breakpoint
INSERT INTO `_location_recurring_object_conversion_guard` (`valid`)
SELECT CASE
	WHEN COUNT(*) = 0 THEN 1
	ELSE 0
END
FROM `location_design`
WHERE CASE
	WHEN json_valid(`document_json`) = 0 THEN 1
	WHEN json_type(`document_json`, '$.design.propsAndRecurringObjects') IS NOT NULL
		AND json_type(`document_json`, '$.design.recurringObjects') IS NOT NULL THEN 1
	ELSE 0
END = 1;--> statement-breakpoint
UPDATE `location_design`
SET `document_json` = json_set(
	json_remove(`document_json`, '$.design.propsAndRecurringObjects'),
	'$.design.recurringObjects',
	json_extract(`document_json`, '$.design.propsAndRecurringObjects')
)
WHERE json_type(`document_json`, '$.design.propsAndRecurringObjects') IS NOT NULL;--> statement-breakpoint
DROP TABLE `_location_recurring_object_conversion_guard`;--> statement-breakpoint
PRAGMA user_version = 56;
