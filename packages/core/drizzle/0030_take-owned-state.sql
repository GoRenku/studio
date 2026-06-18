ALTER TABLE `scene_shot_video_take_generation` ADD `state_json` text DEFAULT '{"version":1,"shotDesignByShotId":{},"referenceSelections":{"dependencyInclusions":{},"selectedCharacterSheetAssetIds":{},"selectedLocationSheetAssetIds":{},"selectedLocationViewIds":{},"selectedLookbookSheetIds":[],"selectedDialogueAudioTakeIds":{}},"production":{}}' NOT NULL;
--> statement-breakpoint
UPDATE `scene_shot_video_take_generation`
SET `state_json` =
  '{"version":1,"shotDesignByShotId":{},"referenceSelections":{"dependencyInclusions":{},"selectedCharacterSheetAssetIds":{},"selectedLocationSheetAssetIds":{},"selectedLocationViewIds":{},"selectedLookbookSheetIds":[],"selectedDialogueAudioTakeIds":{}},"production":' ||
  `production_json` ||
  '}';
--> statement-breakpoint
WITH `take_shot_specs` AS (
  SELECT
    `take`.`id` AS `take_id`,
    `member`.`shot_id` AS `shot_id`,
    json_extract(`shot`.`value`, '$.shotSpecs') AS `shot_specs`
  FROM `scene_shot_video_take_generation` AS `take`
  INNER JOIN `scene_shot_video_take_generation_shot` AS `member`
    ON `member`.`take_generation_id` = `take`.`id`
  INNER JOIN `scene_shot_list` AS `shot_list`
    ON `shot_list`.`id` = `take`.`shot_list_id`
  INNER JOIN json_each(`shot_list`.`document`, '$.shots') AS `shot`
    ON json_extract(`shot`.`value`, '$.shotId') = `member`.`shot_id`
  WHERE json_type(`shot`.`value`, '$.shotSpecs') = 'object'
),
`take_shot_designs` AS (
  SELECT
    `take_id`,
    `shot_id`,
    json_patch(
      '{}',
      json_object(
        'composition',
        json_patch(
          '{}',
          json_object(
            'shotSize', json_extract(`shot_specs`, '$.shotSize'),
            'subjectFraming', json_extract(`shot_specs`, '$.subjectFraming'),
            'cameraAngle', json_extract(`shot_specs`, '$.cameraAngle'),
            'dutch', json_extract(`shot_specs`, '$.dutch'),
            'lens', json_extract(`shot_specs`, '$.lens'),
            'customComposition', json_extract(`shot_specs`, '$.custom.composition')
          )
        ),
        'motion',
        json_patch(
          '{}',
          json_object(
            'movement', json_extract(`shot_specs`, '$.movement.movement'),
            'secondary', json_extract(`shot_specs`, '$.movement.secondary'),
            'directions', json_extract(`shot_specs`, '$.movement.directions'),
            'track', json_extract(`shot_specs`, '$.movement.track'),
            'rig', json_extract(`shot_specs`, '$.movement.rig'),
            'customMotion', json_extract(`shot_specs`, '$.custom.movement')
          )
        ),
        'cast',
        json_patch(
          '{}',
          json_object(
            'castMemberIds', json_extract(`shot_specs`, '$.castReferences.castMemberIds'),
            'characterSheetAssetIds', json_extract(`shot_specs`, '$.castReferences.characterSheetAssetIds')
          )
        ),
        'location',
        json_patch(
          '{}',
          json_object(
            'locationId', json_extract(`shot_specs`, '$.location.locationId'),
            'environmentSheetAssetId', json_extract(`shot_specs`, '$.location.environmentSheetAssetId'),
            'viewIds', json_extract(`shot_specs`, '$.location.viewIds')
          )
        ),
        'lookbook',
        json_patch(
          '{}',
          json_object(
            'lookbookSheetId', json_extract(`shot_specs`, '$.lookbookReference.lookbookSheetId')
          )
        ),
        'referenceImages',
        json_patch(
          '{}',
          json_object(
            'customMediaInputIds', json_extract(`shot_specs`, '$.referenceImages.customReferenceInputIds')
          )
        )
      )
    ) AS `shot_design`
  FROM `take_shot_specs`
)
UPDATE `scene_shot_video_take_generation`
SET `state_json` = json_set(
  `state_json`,
  '$.shotDesignByShotId',
  COALESCE(
    (
      SELECT json_group_object(`shot_id`, json(`shot_design`))
      FROM `take_shot_designs`
      WHERE `take_shot_designs`.`take_id` = `scene_shot_video_take_generation`.`id`
    ),
    json('{}')
  )
);
--> statement-breakpoint
WITH `take_shot_specs` AS (
  SELECT
    `take`.`id` AS `take_id`,
    json_extract(`shot`.`value`, '$.shotSpecs') AS `shot_specs`
  FROM `scene_shot_video_take_generation` AS `take`
  INNER JOIN `scene_shot_video_take_generation_shot` AS `member`
    ON `member`.`take_generation_id` = `take`.`id`
  INNER JOIN `scene_shot_list` AS `shot_list`
    ON `shot_list`.`id` = `take`.`shot_list_id`
  INNER JOIN json_each(`shot_list`.`document`, '$.shots') AS `shot`
    ON json_extract(`shot`.`value`, '$.shotId') = `member`.`shot_id`
  WHERE json_type(`shot`.`value`, '$.shotSpecs') = 'object'
),
`dependency_inclusions` AS (
  SELECT
    `take_id`,
    `inclusion`.`key` AS `dependency_id`,
    `inclusion`.`value` AS `inclusion`
  FROM `take_shot_specs`
  INNER JOIN json_each(`take_shot_specs`.`shot_specs`, '$.referenceInclusions') AS `inclusion`
),
`character_sheets` AS (
  SELECT
    `take_id`,
    `sheet`.`key` AS `cast_member_id`,
    `sheet`.`value` AS `asset_id`
  FROM `take_shot_specs`
  INNER JOIN json_each(`take_shot_specs`.`shot_specs`, '$.castReferences.characterSheetAssetIds') AS `sheet`
),
`location_sheets` AS (
  SELECT
    `take_id`,
    json_extract(`shot_specs`, '$.location.locationId') AS `location_id`,
    json_extract(`shot_specs`, '$.location.environmentSheetAssetId') AS `asset_id`
  FROM `take_shot_specs`
  WHERE json_type(`shot_specs`, '$.location.locationId') = 'text'
    AND json_type(`shot_specs`, '$.location.environmentSheetAssetId') = 'text'
),
`location_views` AS (
  SELECT
    `take_id`,
    json_extract(`shot_specs`, '$.location.locationId') AS `location_id`,
    json_extract(`shot_specs`, '$.location.viewIds') AS `view_ids`
  FROM `take_shot_specs`
  WHERE json_type(`shot_specs`, '$.location.locationId') = 'text'
    AND json_type(`shot_specs`, '$.location.viewIds') = 'array'
),
`lookbook_sheets` AS (
  SELECT DISTINCT
    `take_id`,
    json_extract(`shot_specs`, '$.lookbookReference.lookbookSheetId') AS `sheet_id`
  FROM `take_shot_specs`
  WHERE json_type(`shot_specs`, '$.lookbookReference.lookbookSheetId') = 'text'
)
UPDATE `scene_shot_video_take_generation`
SET `state_json` = json_set(
  `state_json`,
  '$.referenceSelections.dependencyInclusions',
  COALESCE(
    (
      SELECT json_group_object(`dependency_id`, `inclusion`)
      FROM `dependency_inclusions`
      WHERE `dependency_inclusions`.`take_id` = `scene_shot_video_take_generation`.`id`
    ),
    json('{}')
  ),
  '$.referenceSelections.selectedCharacterSheetAssetIds',
  COALESCE(
    (
      SELECT json_group_object(`cast_member_id`, `asset_id`)
      FROM `character_sheets`
      WHERE `character_sheets`.`take_id` = `scene_shot_video_take_generation`.`id`
    ),
    json('{}')
  ),
  '$.referenceSelections.selectedLocationSheetAssetIds',
  COALESCE(
    (
      SELECT json_group_object(`location_id`, `asset_id`)
      FROM `location_sheets`
      WHERE `location_sheets`.`take_id` = `scene_shot_video_take_generation`.`id`
    ),
    json('{}')
  ),
  '$.referenceSelections.selectedLocationViewIds',
  COALESCE(
    (
      SELECT json_group_object(`location_id`, json(`view_ids`))
      FROM `location_views`
      WHERE `location_views`.`take_id` = `scene_shot_video_take_generation`.`id`
    ),
    json('{}')
  ),
  '$.referenceSelections.selectedLookbookSheetIds',
  COALESCE(
    (
      SELECT json_group_array(`sheet_id`)
      FROM `lookbook_sheets`
      WHERE `lookbook_sheets`.`take_id` = `scene_shot_video_take_generation`.`id`
    ),
    json('[]')
  )
);
--> statement-breakpoint
WITH `shot_rows` AS (
  SELECT
    `scene_shot_list`.`id` AS `shot_list_id`,
    `scene_shot_list`.`document` AS `document`,
    CAST(`shot`.`key` AS integer) AS `shot_order`,
    CASE
      WHEN json_type(`shot`.`value`, '$.shotSpecs') = 'object'
      THEN json_remove(`shot`.`value`, '$.shotSpecs')
      ELSE `shot`.`value`
    END AS `shot_json`
  FROM `scene_shot_list`
  INNER JOIN json_each(`scene_shot_list`.`document`, '$.shots') AS `shot`
),
`stripped_shot_lists` AS (
  SELECT
    `shot_list_id`,
    json_set(`document`, '$.shots', json_group_array(json(`shot_json`))) AS `document`
  FROM (
    SELECT * FROM `shot_rows` ORDER BY `shot_list_id`, `shot_order`
  )
  GROUP BY `shot_list_id`
)
UPDATE `scene_shot_list`
SET `document` = (
  SELECT `document`
  FROM `stripped_shot_lists`
  WHERE `stripped_shot_lists`.`shot_list_id` = `scene_shot_list`.`id`
);
--> statement-breakpoint
PRAGMA user_version = 21;
