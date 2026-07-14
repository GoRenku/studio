UPDATE `media_generation_spec`
SET `purpose` = 'cast.character-sheet'
WHERE `purpose` IN ('cast.video-character-sheet', 'cast.storyboard-character-sheet');--> statement-breakpoint

UPDATE `media_generation_run`
SET `purpose` = 'cast.character-sheet'
WHERE `purpose` IN ('cast.video-character-sheet', 'cast.storyboard-character-sheet');--> statement-breakpoint

UPDATE `media_generation_run`
SET `spec_snapshot_json` = json_set(
	`spec_snapshot_json`,
	'$.purpose',
	'cast.character-sheet'
)
WHERE json_extract(`spec_snapshot_json`, '$.purpose') IN (
	'cast.video-character-sheet',
	'cast.storyboard-character-sheet'
);--> statement-breakpoint

UPDATE `media_generation_spec`
SET `references_json` = (
	SELECT json_group_array(json(`reference_json`))
	FROM (
		SELECT CASE
			WHEN json_extract(`value`, '$.placement.slotId') IN (
				'video-character-sheet',
				'storyboard-character-sheet'
			) THEN json_set(`value`, '$.placement.slotId', 'character-sheet')
			ELSE `value`
		END AS `reference_json`
		FROM json_each(`media_generation_spec`.`references_json`)
		ORDER BY CAST(`key` AS integer)
	)
)
WHERE EXISTS (
	SELECT 1
	FROM json_each(`media_generation_spec`.`references_json`)
	WHERE json_extract(`value`, '$.placement.slotId') IN (
		'video-character-sheet',
		'storyboard-character-sheet'
	)
);--> statement-breakpoint

UPDATE `media_generation_run`
SET `spec_snapshot_json` = json_set(
	`spec_snapshot_json`,
	'$.references',
	json((
		SELECT json_group_array(json(`reference_json`))
		FROM (
			SELECT CASE
				WHEN json_extract(`value`, '$.placement.slotId') IN (
					'video-character-sheet',
					'storyboard-character-sheet'
				) THEN json_set(`value`, '$.placement.slotId', 'character-sheet')
				ELSE `value`
			END AS `reference_json`
			FROM json_each(`media_generation_run`.`spec_snapshot_json`, '$.references')
			ORDER BY CAST(`key` AS integer)
		)
	))
)
WHERE EXISTS (
	SELECT 1
	FROM json_each(`media_generation_run`.`spec_snapshot_json`, '$.references')
	WHERE json_extract(`value`, '$.placement.slotId') IN (
		'video-character-sheet',
		'storyboard-character-sheet'
	)
);--> statement-breakpoint

UPDATE `cast_asset`
SET `role` = 'character-sheet'
WHERE `role` IN (
	'character_sheet',
	'video-character-sheet',
	'storyboard-character-sheet'
);
