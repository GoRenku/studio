CREATE TABLE `scene_shot_video_take_input_shot` (
	`input_id` text NOT NULL,
	`shot_id` text NOT NULL,
	`shot_order` integer NOT NULL,
	FOREIGN KEY (`input_id`) REFERENCES `scene_shot_video_take_input`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Backfill explicit input shot membership for inputs created before this table existed.
INSERT INTO `scene_shot_video_take_input_shot` (`input_id`, `shot_id`, `shot_order`)
SELECT
	`scene_shot_video_take_input`.`id`,
	`scene_shot_video_take_generation_shot`.`shot_id`,
	`scene_shot_video_take_generation_shot`.`shot_order`
FROM `scene_shot_video_take_input`
INNER JOIN `scene_shot_video_take_generation_shot`
	ON `scene_shot_video_take_generation_shot`.`take_generation_id` = `scene_shot_video_take_input`.`take_generation_id`;
--> statement-breakpoint
CREATE UNIQUE INDEX `scene_shot_video_take_input_shot_idx` ON `scene_shot_video_take_input_shot` (`input_id`,`shot_id`);--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_input_shot_order_idx` ON `scene_shot_video_take_input_shot` (`input_id`,`shot_order`);