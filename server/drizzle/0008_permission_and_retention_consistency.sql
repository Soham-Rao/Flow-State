-- @flowstate-risk-ack: removes deprecated/no-longer-used role permission grants and changes done-list cleanup default to disabled
DELETE `rp` FROM `role_permissions` `rp`
INNER JOIN `roles` `r` ON `r`.`id` = `rp`.`role_id`
WHERE `r`.`name` = 'Guest';--> statement-breakpoint
DELETE FROM `role_permissions`
WHERE `permission` IN ('view_threads', 'create_threads', 'reply_threads');--> statement-breakpoint
UPDATE `boards`
SET `retention_minutes` = 0
WHERE `retention_minutes` = 10080;--> statement-breakpoint
ALTER TABLE `boards` MODIFY COLUMN `retention_minutes` int NOT NULL DEFAULT 0;
