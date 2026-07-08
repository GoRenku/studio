PRAGMA user_version = 32;--> statement-breakpoint
-- Custom data repair for plan 0095.
--
-- Shot input dependency drafts now declare the lookbook reference source used
-- while generating first frames, last frames, reference images, and video
-- prompt sheets. Existing development databases may contain drafts authored
-- before that required field existed, and may also contain retired
-- purpose-specific generation names inside the draft object. This one-way
-- rewrite applies the current default, Movie Lookbook conditioning, and strips
-- the retired generation purpose field from the destination-owned draft.
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
) = 'array';--> statement-breakpoint
-- Prepared inputs are take-video generation inputs. Development data may still
-- contain the previous multi-shot storyboard input kind. That artifact is the
-- current video prompt sheet, so preserve its asset/file ids while rewriting
-- the stored kind.
UPDATE `scene_shot_video_take`
SET `state_json` = json_set(
	`state_json`,
	'$.production.preparedInputs',
	json(
		COALESCE(
			(
				SELECT json_group_array(json(`rewritten_prepared_input`.`input_json`))
				FROM (
					SELECT
						CASE
							WHEN json_extract(
								`prepared_input`.`value`,
								'$.kind'
							) = 'multi-shot-storyboard-sheet' THEN
								json_set(
									json(`prepared_input`.`value`),
									'$.kind',
									'video-prompt-sheet'
								)
							ELSE json(`prepared_input`.`value`)
						END AS `input_json`
					FROM json_each(
						`scene_shot_video_take`.`state_json`,
						'$.production.preparedInputs'
					) AS `prepared_input`
					ORDER BY CAST(`prepared_input`.`key` AS integer)
				) AS `rewritten_prepared_input`
			),
			'[]'
		)
	)
)
WHERE json_type(`state_json`, '$.production.preparedInputs') = 'array'
AND EXISTS (
	SELECT 1
	FROM json_each(
		`state_json`,
		'$.production.preparedInputs'
	) AS `prepared_input`
	WHERE json_extract(
		`prepared_input`.`value`,
		'$.kind'
	) = 'multi-shot-storyboard-sheet'
);--> statement-breakpoint
UPDATE `scene_shot_video_take_media_input`
SET `input_kind` = 'video-prompt-sheet'
WHERE `input_kind` = 'multi-shot-storyboard-sheet';--> statement-breakpoint
UPDATE `asset`
SET
	`type` = 'shot.input',
	`title` = CASE
		WHEN `title` = 'Shot multi-shot storyboard sheet' THEN
			'Shot video prompt sheet'
		ELSE `title`
	END
WHERE `type` = 'shot.multi-shot-storyboard-sheet';
