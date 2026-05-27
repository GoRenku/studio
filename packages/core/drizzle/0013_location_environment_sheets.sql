CREATE TABLE `location_environment_sheet_view` (
	`id` text PRIMARY KEY NOT NULL,
	`sheet_id` text NOT NULL,
	`azimuth_degrees` integer NOT NULL,
	`asset_file_id` text NOT NULL,
	`crop_x` integer NOT NULL,
	`crop_y` integer NOT NULL,
	`crop_width` integer NOT NULL,
	`crop_height` integer NOT NULL,
	`extraction_confidence` text NOT NULL,
	`extraction_method` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`sheet_id`) REFERENCES `location_environment_sheet`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `location_environment_sheet_view_azimuth_idx` ON `location_environment_sheet_view` (`sheet_id`,`azimuth_degrees`);--> statement-breakpoint
CREATE INDEX `location_environment_sheet_view_order_idx` ON `location_environment_sheet_view` (`sheet_id`,`sort_order`,`id`);--> statement-breakpoint
CREATE TABLE `location_environment_sheet` (
	`id` text PRIMARY KEY NOT NULL,
	`location_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`composite_file_id` text NOT NULL,
	`layout_template` text NOT NULL,
	`view_frame` text NOT NULL,
	`sheet_frame` text NOT NULL,
	`grid_layout` text NOT NULL,
	`extraction_confidence` text NOT NULL,
	`extraction_method` text NOT NULL,
	`extraction_diagnostics_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`composite_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `location_environment_sheet_asset_idx` ON `location_environment_sheet` (`asset_id`);--> statement-breakpoint
CREATE INDEX `location_environment_sheet_location_created_idx` ON `location_environment_sheet` (`location_id`,`created_at`,`id`);--> statement-breakpoint
PRAGMA user_version = 7;
