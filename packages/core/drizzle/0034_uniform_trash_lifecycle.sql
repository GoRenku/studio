CREATE TABLE `trash_item` (
	`id` text PRIMARY KEY NOT NULL,
	`operation_id` text NOT NULL,
	`item_kind` text NOT NULL,
	`item_id` text NOT NULL,
	`owner_kind` text,
	`owner_id` text,
	`title` text NOT NULL,
	`original_project_relative_path` text,
	`trash_project_relative_path` text,
	`restore_snapshot_json` text NOT NULL,
	`created_at` text NOT NULL,
	`restored_at` text,
	`garbage_collected_at` text,
	FOREIGN KEY (`operation_id`) REFERENCES `trash_operation`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `trash_item_operation_idx` ON `trash_item` (`operation_id`);--> statement-breakpoint
CREATE INDEX `trash_item_kind_item_idx` ON `trash_item` (`item_kind`,`item_id`);--> statement-breakpoint
CREATE INDEX `trash_item_owner_idx` ON `trash_item` (`owner_kind`,`owner_id`);--> statement-breakpoint
CREATE INDEX `trash_item_state_created_idx` ON `trash_item` (`restored_at`,`garbage_collected_at`,`created_at`);--> statement-breakpoint
CREATE TABLE `trash_operation` (
	`id` text PRIMARY KEY NOT NULL,
	`command_name` text NOT NULL,
	`actor_kind` text NOT NULL,
	`actor_label` text,
	`reason` text,
	`created_at` text NOT NULL,
	`restored_at` text,
	`garbage_collected_at` text
);
--> statement-breakpoint
CREATE INDEX `trash_operation_created_idx` ON `trash_operation` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `trash_operation_state_idx` ON `trash_operation` (`restored_at`,`garbage_collected_at`,`created_at`);--> statement-breakpoint
DROP INDEX `cast_voice_sample_asset_idx`;--> statement-breakpoint
DROP INDEX `cast_voice_cast_name_idx`;--> statement-breakpoint
ALTER TABLE `cast_voice` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `cast_voice` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `cast_voice` ADD `restored_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `cast_voice_sample_asset_idx` ON `cast_voice` (`sample_asset_id`) WHERE "cast_voice"."discarded_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `cast_voice_cast_name_idx` ON `cast_voice` (`cast_member_id`,`name`) WHERE "cast_voice"."discarded_at" is null;--> statement-breakpoint
DROP INDEX `scene_shot_video_take_media_input_selected_idx`;--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_media_input` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_media_input` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_media_input` ADD `restored_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `scene_shot_video_take_media_input_selected_idx` ON `scene_shot_video_take_media_input` (`scene_id`,`take_id`,`input_kind`,`subject_kind`,`subject_id`) WHERE "scene_shot_video_take_media_input"."selection" = 'select' and "scene_shot_video_take_media_input"."discarded_at" is null;--> statement-breakpoint
DROP INDEX `scene_shot_video_take_output_selected_idx`;--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_output` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_output` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_output` ADD `restored_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `scene_shot_video_take_output_selected_idx` ON `scene_shot_video_take_output` (`scene_id`,`take_id`) WHERE "scene_shot_video_take_output"."is_selected" = 1 and "scene_shot_video_take_output"."discarded_at" is null;--> statement-breakpoint
DROP INDEX `lookbook_inspiration_folder_unique_idx`;--> statement-breakpoint
DROP INDEX `lookbook_inspiration_order_unique_idx`;--> statement-breakpoint
ALTER TABLE `lookbook_inspiration` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `lookbook_inspiration` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `lookbook_inspiration` ADD `restored_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `lookbook_inspiration_folder_unique_idx` ON `lookbook_inspiration` (`lookbook_id`,`inspiration_folder_id`) WHERE "lookbook_inspiration"."discarded_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `lookbook_inspiration_order_unique_idx` ON `lookbook_inspiration` (`lookbook_id`,`sort_order`) WHERE "lookbook_inspiration"."discarded_at" is null;--> statement-breakpoint
ALTER TABLE `asset_file` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `asset_file` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `asset_file` ADD `restored_at` text;--> statement-breakpoint
ALTER TABLE `asset` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `asset` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `asset` ADD `restored_at` text;--> statement-breakpoint
ALTER TABLE `cast_asset` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `cast_asset` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `cast_asset` ADD `restored_at` text;--> statement-breakpoint
ALTER TABLE `location_asset` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `location_asset` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `location_asset` ADD `restored_at` text;--> statement-breakpoint
ALTER TABLE `location_environment_sheet_view` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `location_environment_sheet_view` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `location_environment_sheet_view` ADD `restored_at` text;--> statement-breakpoint
ALTER TABLE `location_environment_sheet` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `location_environment_sheet` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `location_environment_sheet` ADD `restored_at` text;--> statement-breakpoint
ALTER TABLE `project_asset` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `project_asset` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `project_asset` ADD `restored_at` text;--> statement-breakpoint
ALTER TABLE `scene_asset` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `scene_asset` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `scene_asset` ADD `restored_at` text;--> statement-breakpoint
ALTER TABLE `sequence_asset` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `sequence_asset` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `sequence_asset` ADD `restored_at` text;--> statement-breakpoint
ALTER TABLE `cast_voice_provider_registration` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `cast_voice_provider_registration` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `cast_voice_provider_registration` ADD `restored_at` text;--> statement-breakpoint
ALTER TABLE `scene_shot_storyboard_image` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `scene_shot_storyboard_image` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `scene_shot_storyboard_image` ADD `restored_at` text;--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_media_input_shot` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_media_input_shot` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_media_input_shot` ADD `restored_at` text;--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_output_shot` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_output_shot` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_output_shot` ADD `restored_at` text;--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_shot` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_shot` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `scene_shot_video_take_shot` ADD `restored_at` text;--> statement-breakpoint
ALTER TABLE `scene_shot_video_take` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `scene_shot_video_take` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `scene_shot_video_take` ADD `restored_at` text;--> statement-breakpoint
ALTER TABLE `scene_dialogue_audio_take` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `scene_dialogue_audio_take` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `scene_dialogue_audio_take` ADD `restored_at` text;--> statement-breakpoint
ALTER TABLE `inspiration_analysis` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `inspiration_analysis` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `inspiration_analysis` ADD `restored_at` text;--> statement-breakpoint
ALTER TABLE `inspiration_folder` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `inspiration_folder` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `inspiration_folder` ADD `restored_at` text;--> statement-breakpoint
ALTER TABLE `lookbook` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `lookbook` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `lookbook` ADD `restored_at` text;--> statement-breakpoint
ALTER TABLE `lookbook_card_image` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `lookbook_card_image` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `lookbook_card_image` ADD `restored_at` text;--> statement-breakpoint
ALTER TABLE `lookbook_image_section` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `lookbook_image_section` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `lookbook_image_section` ADD `restored_at` text;--> statement-breakpoint
ALTER TABLE `lookbook_image` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `lookbook_image` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `lookbook_image` ADD `restored_at` text;--> statement-breakpoint
ALTER TABLE `lookbook_sheet` ADD `discarded_at` text;--> statement-breakpoint
ALTER TABLE `lookbook_sheet` ADD `discard_operation_id` text;--> statement-breakpoint
ALTER TABLE `lookbook_sheet` ADD `restored_at` text;--> statement-breakpoint
PRAGMA user_version = 25;
