PRAGMA user_version = 34;--> statement-breakpoint
CREATE TABLE `scene_shot_video_take_video` (
	`take_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`asset_file_id` text NOT NULL,
	`media_generation_run_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	FOREIGN KEY (`take_id`) REFERENCES `scene_shot_video_take`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`media_generation_run_id`) REFERENCES `media_generation_run`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scene_shot_video_take_video_take_id_unique` ON `scene_shot_video_take_video` (`take_id`);--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_video_take_idx` ON `scene_shot_video_take_video` (`take_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_video_asset_idx` ON `scene_shot_video_take_video` (`asset_id`);--> statement-breakpoint
ALTER TABLE `scene_shot_video_take` ADD `regenerated_from_take_id` text REFERENCES scene_shot_video_take(id);--> statement-breakpoint
CREATE TEMP TABLE `__shot_video_take_output_ranked` AS
SELECT
	`scene_shot_video_take_output`.*,
	ROW_NUMBER() OVER (
		PARTITION BY `scene_shot_video_take_output`.`take_id`
		ORDER BY
			`scene_shot_video_take_output`.`is_selected` DESC,
			`scene_shot_video_take_output`.`created_at` DESC,
			`scene_shot_video_take_output`.`id` DESC
	) AS `output_rank`
FROM `scene_shot_video_take_output`
WHERE `scene_shot_video_take_output`.`discarded_at` IS NULL;--> statement-breakpoint
INSERT INTO `scene_shot_video_take` (
	`id`,
	`scene_id`,
	`source_shot_list_id`,
	`title`,
	`state_json`,
	`is_picked`,
	`regenerated_from_take_id`,
	`history_snapshot_json`,
	`created_at`,
	`updated_at`,
	`discarded_at`,
	`discard_operation_id`,
	`restored_at`
)
SELECT
	'scene_shot_video_take_regenerated_' || `output`.`id`,
	`take`.`scene_id`,
	`take`.`source_shot_list_id`,
	`take`.`title` || ' regeneration',
	`take`.`state_json`,
	0,
	`take`.`id`,
	`take`.`history_snapshot_json`,
	`output`.`created_at`,
	`output`.`updated_at`,
	`take`.`discarded_at`,
	`take`.`discard_operation_id`,
	`take`.`restored_at`
FROM `__shot_video_take_output_ranked` `output`
INNER JOIN `scene_shot_video_take` `take`
	ON `take`.`id` = `output`.`take_id`
WHERE `output`.`output_rank` > 1;--> statement-breakpoint
INSERT INTO `scene_shot_video_take_shot` (
	`take_id`,
	`shot_id`,
	`shot_order`,
	`shot_content_fingerprint`,
	`storyboard_image_id`,
	`storyboard_asset_file_id`,
	`storyboard_content_fingerprint`,
	`discarded_at`,
	`discard_operation_id`,
	`restored_at`
)
SELECT
	'scene_shot_video_take_regenerated_' || `output`.`id`,
	`output_shot`.`shot_id`,
	`output_shot`.`shot_order`,
	`source_shot`.`shot_content_fingerprint`,
	`source_shot`.`storyboard_image_id`,
	`source_shot`.`storyboard_asset_file_id`,
	`source_shot`.`storyboard_content_fingerprint`,
	`source_shot`.`discarded_at`,
	`source_shot`.`discard_operation_id`,
	`source_shot`.`restored_at`
FROM `__shot_video_take_output_ranked` `output`
INNER JOIN `scene_shot_video_take_output_shot` `output_shot`
	ON `output_shot`.`output_id` = `output`.`id`
INNER JOIN `scene_shot_video_take_shot` `source_shot`
	ON `source_shot`.`take_id` = `output`.`take_id`
	AND `source_shot`.`shot_id` = `output_shot`.`shot_id`
WHERE `output`.`output_rank` > 1;--> statement-breakpoint
INSERT INTO `scene_shot_video_take_media_input` (
	`id`,
	`scene_id`,
	`take_id`,
	`input_kind`,
	`subject_kind`,
	`subject_id`,
	`asset_id`,
	`asset_file_id`,
	`media_generation_run_id`,
	`selection`,
	`created_at`,
	`updated_at`,
	`discarded_at`,
	`discard_operation_id`,
	`restored_at`
)
SELECT
	`input`.`id` || '_copy_' || `output`.`id`,
	`input`.`scene_id`,
	'scene_shot_video_take_regenerated_' || `output`.`id`,
	`input`.`input_kind`,
	`input`.`subject_kind`,
	`input`.`subject_id`,
	`input`.`asset_id`,
	`input`.`asset_file_id`,
	`input`.`media_generation_run_id`,
	`input`.`selection`,
	`input`.`created_at`,
	`output`.`updated_at`,
	`input`.`discarded_at`,
	`input`.`discard_operation_id`,
	`input`.`restored_at`
FROM `__shot_video_take_output_ranked` `output`
INNER JOIN `scene_shot_video_take_media_input` `input`
	ON `input`.`take_id` = `output`.`take_id`
WHERE `output`.`output_rank` > 1
	AND `input`.`selection` = 'select'
	AND `input`.`discarded_at` IS NULL;--> statement-breakpoint
INSERT INTO `scene_shot_video_take_media_input_shot` (
	`input_id`,
	`shot_id`,
	`shot_order`,
	`discarded_at`,
	`discard_operation_id`,
	`restored_at`
)
SELECT
	`input_shot`.`input_id` || '_copy_' || `output`.`id`,
	`input_shot`.`shot_id`,
	`input_shot`.`shot_order`,
	`input_shot`.`discarded_at`,
	`input_shot`.`discard_operation_id`,
	`input_shot`.`restored_at`
FROM `__shot_video_take_output_ranked` `output`
INNER JOIN `scene_shot_video_take_media_input` `input`
	ON `input`.`take_id` = `output`.`take_id`
INNER JOIN `scene_shot_video_take_media_input_shot` `input_shot`
	ON `input_shot`.`input_id` = `input`.`id`
WHERE `output`.`output_rank` > 1
	AND `input`.`selection` = 'select'
	AND `input`.`discarded_at` IS NULL;--> statement-breakpoint
INSERT INTO `scene_shot_video_take_video` (
	`take_id`,
	`asset_id`,
	`asset_file_id`,
	`media_generation_run_id`,
	`created_at`,
	`updated_at`,
	`discarded_at`,
	`discard_operation_id`,
	`restored_at`
)
SELECT
	CASE
		WHEN `output`.`output_rank` = 1 THEN `output`.`take_id`
		ELSE 'scene_shot_video_take_regenerated_' || `output`.`id`
	END,
	`output`.`asset_id`,
	`output`.`asset_file_id`,
	`output`.`media_generation_run_id`,
	`output`.`created_at`,
	`output`.`updated_at`,
	`output`.`discarded_at`,
	`output`.`discard_operation_id`,
	`output`.`restored_at`
FROM `__shot_video_take_output_ranked` `output`;--> statement-breakpoint
DROP TABLE `__shot_video_take_output_ranked`;--> statement-breakpoint
DROP TABLE `scene_shot_video_take_output_shot`;--> statement-breakpoint
DROP TABLE `scene_shot_video_take_output`;
