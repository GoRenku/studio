ALTER TABLE `location_environment_sheet_view` DROP COLUMN `crop_x`;--> statement-breakpoint
ALTER TABLE `location_environment_sheet_view` DROP COLUMN `crop_y`;--> statement-breakpoint
ALTER TABLE `location_environment_sheet_view` DROP COLUMN `crop_width`;--> statement-breakpoint
ALTER TABLE `location_environment_sheet_view` DROP COLUMN `crop_height`;--> statement-breakpoint
ALTER TABLE `location_environment_sheet_view` DROP COLUMN `extraction_confidence`;--> statement-breakpoint
ALTER TABLE `location_environment_sheet_view` DROP COLUMN `extraction_method`;--> statement-breakpoint
ALTER TABLE `location_environment_sheet` DROP COLUMN `layout_template`;--> statement-breakpoint
ALTER TABLE `location_environment_sheet` DROP COLUMN `view_frame`;--> statement-breakpoint
ALTER TABLE `location_environment_sheet` DROP COLUMN `sheet_frame`;--> statement-breakpoint
ALTER TABLE `location_environment_sheet` DROP COLUMN `grid_layout`;--> statement-breakpoint
ALTER TABLE `location_environment_sheet` DROP COLUMN `extraction_confidence`;--> statement-breakpoint
ALTER TABLE `location_environment_sheet` DROP COLUMN `extraction_method`;--> statement-breakpoint
ALTER TABLE `location_environment_sheet` DROP COLUMN `extraction_diagnostics_json`;--> statement-breakpoint
PRAGMA user_version = 9;
