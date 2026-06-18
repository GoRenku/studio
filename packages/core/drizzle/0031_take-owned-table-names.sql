PRAGMA foreign_keys=OFF;
--> statement-breakpoint
DROP INDEX IF EXISTS `scene_shot_video_take_generation_scene_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `scene_shot_video_take_generation_shot_list_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `scene_shot_video_take_generation_shot_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `scene_shot_video_take_generation_shot_order_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `scene_shot_video_take_input_generation_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `scene_shot_video_take_input_asset_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `scene_shot_video_take_input_selected_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `scene_shot_video_take_input_shot_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `scene_shot_video_take_input_shot_order_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `scene_shot_video_take_generation_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `scene_shot_video_take_asset_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `scene_shot_video_take_selected_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `scene_shot_video_take_shot_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `scene_shot_video_take_shot_order_idx`;
--> statement-breakpoint
ALTER TABLE `scene_shot_video_take` RENAME TO `scene_shot_video_take_output`;
--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_output` RENAME COLUMN `take_generation_id` TO `take_id`;
--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_shot` RENAME TO `scene_shot_video_take_output_shot`;
--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_output_shot` RENAME COLUMN `take_id` TO `output_id`;
--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_generation` RENAME TO `scene_shot_video_take`;
--> statement-breakpoint
ALTER TABLE `scene_shot_video_take` RENAME COLUMN `compatibility_snapshot_json` TO `history_snapshot_json`;
--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_generation_shot` RENAME TO `scene_shot_video_take_shot`;
--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_shot` RENAME COLUMN `take_generation_id` TO `take_id`;
--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_input` RENAME TO `scene_shot_video_take_media_input`;
--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_media_input` RENAME COLUMN `take_generation_id` TO `take_id`;
--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_input_shot` RENAME TO `scene_shot_video_take_media_input_shot`;
--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_scene_idx` ON `scene_shot_video_take` (`scene_id`, `updated_at`, `id`);
--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_source_shot_list_idx` ON `scene_shot_video_take` (`shot_list_id`, `created_at`, `id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `scene_shot_video_take_shot_idx` ON `scene_shot_video_take_shot` (`take_id`, `shot_id`);
--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_shot_order_idx` ON `scene_shot_video_take_shot` (`take_id`, `shot_order`);
--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_media_input_take_idx` ON `scene_shot_video_take_media_input` (`scene_id`, `take_id`, `created_at`, `id`);
--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_media_input_asset_idx` ON `scene_shot_video_take_media_input` (`asset_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `scene_shot_video_take_media_input_selected_idx` ON `scene_shot_video_take_media_input` (`scene_id`, `take_id`, `input_kind`, `subject_kind`, `subject_id`) WHERE `selection` = 'select';
--> statement-breakpoint
CREATE UNIQUE INDEX `scene_shot_video_take_media_input_shot_idx` ON `scene_shot_video_take_media_input_shot` (`input_id`, `shot_id`);
--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_media_input_shot_order_idx` ON `scene_shot_video_take_media_input_shot` (`input_id`, `shot_order`);
--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_output_take_idx` ON `scene_shot_video_take_output` (`scene_id`, `take_id`, `created_at`, `id`);
--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_output_asset_idx` ON `scene_shot_video_take_output` (`asset_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `scene_shot_video_take_output_selected_idx` ON `scene_shot_video_take_output` (`scene_id`, `take_id`) WHERE `is_selected` = 1;
--> statement-breakpoint
CREATE UNIQUE INDEX `scene_shot_video_take_output_shot_idx` ON `scene_shot_video_take_output_shot` (`output_id`, `shot_id`);
--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_output_shot_order_idx` ON `scene_shot_video_take_output_shot` (`output_id`, `shot_order`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
PRAGMA user_version = 22;
