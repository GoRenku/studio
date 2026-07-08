PRAGMA user_version = 37;--> statement-breakpoint
-- Custom one-way cleanup for generic image.create shot input generation.
--
-- Existing development databases may already have applied 0042 before it
-- stripped retired shot input generation purposes from authored dependency
-- drafts. Current take state treats shot input roles as import/dependency
-- kinds, so dependency drafts must not retain the retired purpose field.
UPDATE `scene_shot_video_take`
SET `state_json` = json_set(
	`state_json`,
	'$.production.agentProposal.dependencyDrafts',
	json(
		COALESCE(
			(
				SELECT json_group_array(json(`rewritten_dependency_draft`.`draft_json`))
				FROM (
					SELECT
						CASE
							WHEN json_type(
								`dependency_draft`.`value`,
								'$.referenceMode'
							) IS NULL THEN
								json_set(
									json_remove(json(`dependency_draft`.`value`), '$.purpose'),
									'$.referenceMode',
									'movie-lookbook'
								)
							ELSE json_remove(json(`dependency_draft`.`value`), '$.purpose')
						END AS `draft_json`
					FROM json_each(
						`scene_shot_video_take`.`state_json`,
						'$.production.agentProposal.dependencyDrafts'
					) AS `dependency_draft`
					ORDER BY CAST(`dependency_draft`.`key` AS integer)
				) AS `rewritten_dependency_draft`
			),
			'[]'
		)
	)
)
WHERE json_type(
	`state_json`,
	'$.production.agentProposal.dependencyDrafts'
) = 'array'
AND EXISTS (
	SELECT 1
	FROM json_each(
		`state_json`,
		'$.production.agentProposal.dependencyDrafts'
	) AS `dependency_draft`
	WHERE json_type(`dependency_draft`.`value`, '$.purpose') IS NOT NULL
		OR json_type(`dependency_draft`.`value`, '$.referenceMode') IS NULL
);--> statement-breakpoint
UPDATE `scene_shot_video_take_media_input`
SET `media_generation_run_id` = NULL
WHERE `media_generation_run_id` IN (
	SELECT `id`
	FROM `media_generation_run`
	WHERE `purpose` IN (
		'shot.first-frame',
		'shot.last-frame',
		'shot.reference-image',
		'shot.video-prompt-sheet'
	)
);--> statement-breakpoint
UPDATE `scene_shot_video_take_video`
SET `media_generation_run_id` = NULL
WHERE `media_generation_run_id` IN (
	SELECT `id`
	FROM `media_generation_run`
	WHERE `purpose` IN (
		'shot.first-frame',
		'shot.last-frame',
		'shot.reference-image',
		'shot.video-prompt-sheet'
	)
);--> statement-breakpoint
DELETE FROM `media_generation_run`
WHERE `purpose` IN (
	'shot.first-frame',
	'shot.last-frame',
	'shot.reference-image',
	'shot.video-prompt-sheet'
);--> statement-breakpoint
DELETE FROM `media_generation_spec`
WHERE `purpose` IN (
	'shot.first-frame',
	'shot.last-frame',
	'shot.reference-image',
	'shot.video-prompt-sheet'
);
