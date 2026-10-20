-- Cast Member, Location and Prop descriptions become sectioned JSON documents
-- (plan 0239). Existing free text cannot be split into sections safely, so it
-- moves word for word into the `overview` section. Blank text becomes NULL.
UPDATE `cast_member`
SET `description` = CASE
	WHEN `description` IS NULL OR trim(`description`, ' ' || char(9, 10, 13)) = '' THEN NULL
	ELSE json_object('overview', `description`)
END;--> statement-breakpoint
UPDATE `location`
SET `description` = CASE
	WHEN `description` IS NULL OR trim(`description`, ' ' || char(9, 10, 13)) = '' THEN NULL
	ELSE json_object('overview', `description`)
END;--> statement-breakpoint
UPDATE `prop`
SET `description` = CASE
	WHEN `description` IS NULL OR trim(`description`, ' ' || char(9, 10, 13)) = '' THEN NULL
	ELSE json_object('overview', `description`)
END;--> statement-breakpoint
PRAGMA user_version = 74;
