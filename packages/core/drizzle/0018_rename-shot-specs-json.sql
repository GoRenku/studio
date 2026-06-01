PRAGMA user_version = 12;--> statement-breakpoint

UPDATE scene_shot_list
SET document = json_set(
  document,
  '$.shots',
  (
    SELECT json_group_array(json(shot_json))
    FROM (
      SELECT
        CASE
          WHEN json_type(shot.value, '$.cameraDesign') IS NULL THEN shot.value
          ELSE json_remove(
            json_set(
              shot.value,
              '$.shotSpecs',
              json(
                CASE
                  WHEN json_type(shot.value, '$.cameraDesign.equipment') IS NULL THEN
                    json_remove(
                      json_extract(shot.value, '$.cameraDesign'),
                      '$.equipment'
                    )
                  ELSE
                    json_set(
                      json_remove(
                        json_extract(shot.value, '$.cameraDesign'),
                        '$.equipment'
                      ),
                      '$.lens',
                      json(
                        json_patch(
                          json_patch(
                            json_patch(
                              '{}',
                              CASE
                                WHEN json_type(shot.value, '$.cameraDesign.equipment.lens') IS NULL THEN '{}'
                                ELSE json_object('type', json_extract(shot.value, '$.cameraDesign.equipment.lens'))
                              END
                            ),
                            CASE
                              WHEN json_type(shot.value, '$.cameraDesign.equipment.lensMillimeters') IS NULL THEN '{}'
                              ELSE json_object('millimeters', json_extract(shot.value, '$.cameraDesign.equipment.lensMillimeters'))
                            END
                          ),
                          CASE
                            WHEN json_type(shot.value, '$.cameraDesign.equipment.focus') IS NULL THEN '{}'
                            ELSE json_object('focus', json_extract(shot.value, '$.cameraDesign.equipment.focus'))
                          END
                        )
                      )
                    )
                END
              )
            ),
            '$.cameraDesign'
          )
        END AS shot_json
      FROM json_each(document, '$.shots') AS shot
      ORDER BY CAST(shot.key AS INTEGER)
    )
  )
)
WHERE json_type(document, '$.shots') = 'array'
  AND document LIKE '%"cameraDesign"%';
