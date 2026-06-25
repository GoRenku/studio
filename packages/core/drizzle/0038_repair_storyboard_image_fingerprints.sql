UPDATE `scene_shot_storyboard_image`
SET `shot_content_fingerprint` = (
  SELECT json_object(
    'title', json_extract(`shot`.`value`, '$.title'),
    'storyBeat', json_extract(`shot`.`value`, '$.storyBeat'),
    'narrativePurpose', json_extract(`shot`.`value`, '$.narrativePurpose'),
    'description', json_extract(`shot`.`value`, '$.description'),
    'shotType', json_extract(`shot`.`value`, '$.shotType'),
    'cameraAngle', json_extract(`shot`.`value`, '$.cameraAngle'),
    'cameraMovement', json_extract(`shot`.`value`, '$.cameraMovement'),
    'framing', json_extract(`shot`.`value`, '$.framing'),
    'lensIntent', json_extract(`shot`.`value`, '$.lensIntent'),
    'aspectRatio', json_extract(`shot`.`value`, '$.aspectRatio'),
    'subject', json_extract(`shot`.`value`, '$.subject'),
    'action', json_extract(`shot`.`value`, '$.action'),
    'dialogue', json(json_extract(`shot`.`value`, '$.dialogue')),
    'coveredBlockIndexes', json(json_extract(`shot`.`value`, '$.coveredBlockIndexes')),
    'castMemberIds', json(json_extract(`shot`.`value`, '$.castMemberIds')),
    'locationIds', json(json_extract(`shot`.`value`, '$.locationIds')),
    'audioNotes', json_extract(`shot`.`value`, '$.audioNotes'),
    'productionNotes', json_extract(`shot`.`value`, '$.productionNotes')
  )
  FROM `scene_shot_list`
  JOIN json_each(`scene_shot_list`.`document`, '$.shots') AS `shot`
  WHERE `scene_shot_list`.`id` = `scene_shot_storyboard_image`.`shot_list_id`
    AND `scene_shot_list`.`scene_id` = `scene_shot_storyboard_image`.`scene_id`
    AND json_extract(`shot`.`value`, '$.shotId') = `scene_shot_storyboard_image`.`shot_id`
)
WHERE `shot_content_fingerprint` LIKE 'legacy:%'
  AND EXISTS (
    SELECT 1
    FROM `scene_shot_list`
    JOIN json_each(`scene_shot_list`.`document`, '$.shots') AS `shot`
    WHERE `scene_shot_list`.`id` = `scene_shot_storyboard_image`.`shot_list_id`
      AND `scene_shot_list`.`scene_id` = `scene_shot_storyboard_image`.`scene_id`
      AND json_extract(`shot`.`value`, '$.shotId') = `scene_shot_storyboard_image`.`shot_id`
  );
