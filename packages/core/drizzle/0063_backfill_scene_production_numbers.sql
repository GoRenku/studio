INSERT INTO `scene_production_number` (`production_number`, `scene_id`)
SELECT
	CAST(ROW_NUMBER() OVER (
		ORDER BY
			`act`.`position`,
			`act`.`id`,
			`sequence`.`position`,
			`sequence`.`id`,
			`scene`.`position`,
			`scene`.`id`
	) AS TEXT),
	`scene`.`id`
FROM `scene`
INNER JOIN `sequence` ON `sequence`.`id` = `scene`.`sequence_id`
INNER JOIN `act` ON `act`.`id` = `sequence`.`act_id`;--> statement-breakpoint
PRAGMA user_version = 49;
