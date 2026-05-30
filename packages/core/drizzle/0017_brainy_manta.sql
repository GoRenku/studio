DROP INDEX `scene_shot_storyboard_sheet_asset_idx`;--> statement-breakpoint
CREATE INDEX `scene_shot_storyboard_sheet_asset_idx` ON `scene_shot_storyboard_sheet` (`asset_id`);--> statement-breakpoint
PRAGMA user_version = 11;
