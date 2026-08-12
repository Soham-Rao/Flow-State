-- @flowstate-risk-ack: additive workspace columns plus lossless backfill of the existing single workspace; no application rows are deleted
CREATE TABLE `workspaces` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`join_code_hash` varchar(255),
	`created_by` char(36),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `workspaces_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_workspaces_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `idx_workspaces_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `workspaces` ADD CONSTRAINT `workspaces_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `idx_workspaces_status` ON `workspaces` (`status`);
--> statement-breakpoint
INSERT INTO `workspaces` (`id`, `name`, `slug`, `status`, `created_by`, `created_at`, `updated_at`)
VALUES ('8f3e0d8d-2c1c-4e31-9c97-6b724b586001', 'Dynamic Remedies Marketing Workspace', 'dynamic-remedies-marketing', 'active', NULL, NOW(3), NOW(3));
--> statement-breakpoint
CREATE TABLE `workspace_memberships` (
	`workspace_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`status` enum('active','suspended','removed') NOT NULL DEFAULT 'active',
	`role` enum('admin','member','guest') NOT NULL DEFAULT 'guest',
	`joined_at` datetime(3) NOT NULL,
	`last_accessed_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `workspace_memberships_workspace_id_user_id_pk` PRIMARY KEY(`workspace_id`,`user_id`)
);
--> statement-breakpoint
ALTER TABLE `workspace_memberships` ADD CONSTRAINT `workspace_memberships_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `workspace_memberships` ADD CONSTRAINT `workspace_memberships_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `idx_workspace_memberships_user_status` ON `workspace_memberships` (`user_id`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_workspace_memberships_workspace_status` ON `workspace_memberships` (`workspace_id`,`status`);
--> statement-breakpoint
INSERT INTO `workspace_memberships` (`workspace_id`, `user_id`, `status`, `role`, `joined_at`, `last_accessed_at`, `created_at`, `updated_at`)
SELECT '8f3e0d8d-2c1c-4e31-9c97-6b724b586001', `id`, 'active', `role`, `created_at`, NULL, `created_at`, NOW(3) FROM `users`;
--> statement-breakpoint
ALTER TABLE `invites` ADD `workspace_id` char(36);
--> statement-breakpoint
ALTER TABLE `email_notification_deliveries` ADD `workspace_id` char(36);
--> statement-breakpoint
ALTER TABLE `calendar_feed_tokens` ADD `workspace_id` char(36);
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `workspace_id` char(36);
--> statement-breakpoint
ALTER TABLE `bug_reports` ADD `workspace_id` char(36);
--> statement-breakpoint
ALTER TABLE `roles` ADD `workspace_id` char(36);
--> statement-breakpoint
ALTER TABLE `user_roles` ADD `workspace_id` char(36);
--> statement-breakpoint
ALTER TABLE `boards` ADD `workspace_id` char(36);
--> statement-breakpoint
ALTER TABLE `announcements` ADD `workspace_id` char(36);
--> statement-breakpoint
ALTER TABLE `thread_conversations` ADD `workspace_id` char(36);
--> statement-breakpoint
ALTER TABLE `activity_logs` ADD `workspace_id` char(36);
--> statement-breakpoint
UPDATE `invites` SET `workspace_id` = '8f3e0d8d-2c1c-4e31-9c97-6b724b586001' WHERE `workspace_id` IS NULL;
--> statement-breakpoint
UPDATE `email_notification_deliveries` SET `workspace_id` = '8f3e0d8d-2c1c-4e31-9c97-6b724b586001' WHERE `workspace_id` IS NULL;
--> statement-breakpoint
UPDATE `calendar_feed_tokens` SET `workspace_id` = '8f3e0d8d-2c1c-4e31-9c97-6b724b586001' WHERE `workspace_id` IS NULL;
--> statement-breakpoint
UPDATE `audit_logs` SET `workspace_id` = '8f3e0d8d-2c1c-4e31-9c97-6b724b586001' WHERE `workspace_id` IS NULL;
--> statement-breakpoint
UPDATE `bug_reports` SET `workspace_id` = '8f3e0d8d-2c1c-4e31-9c97-6b724b586001' WHERE `workspace_id` IS NULL;
--> statement-breakpoint
UPDATE `roles` SET `workspace_id` = '8f3e0d8d-2c1c-4e31-9c97-6b724b586001' WHERE `workspace_id` IS NULL;
--> statement-breakpoint
UPDATE `user_roles` SET `workspace_id` = '8f3e0d8d-2c1c-4e31-9c97-6b724b586001' WHERE `workspace_id` IS NULL;
--> statement-breakpoint
UPDATE `boards` SET `workspace_id` = '8f3e0d8d-2c1c-4e31-9c97-6b724b586001' WHERE `workspace_id` IS NULL;
--> statement-breakpoint
UPDATE `announcements` SET `workspace_id` = '8f3e0d8d-2c1c-4e31-9c97-6b724b586001' WHERE `workspace_id` IS NULL;
--> statement-breakpoint
UPDATE `thread_conversations` SET `workspace_id` = '8f3e0d8d-2c1c-4e31-9c97-6b724b586001' WHERE `workspace_id` IS NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `workspace_id` = '8f3e0d8d-2c1c-4e31-9c97-6b724b586001' WHERE `workspace_id` IS NULL;
--> statement-breakpoint
ALTER TABLE `invites` MODIFY COLUMN `workspace_id` char(36) NOT NULL;
--> statement-breakpoint
ALTER TABLE `email_notification_deliveries` MODIFY COLUMN `workspace_id` char(36) NOT NULL;
--> statement-breakpoint
ALTER TABLE `calendar_feed_tokens` MODIFY COLUMN `workspace_id` char(36) NOT NULL;
--> statement-breakpoint
ALTER TABLE `bug_reports` MODIFY COLUMN `workspace_id` char(36) NOT NULL;
--> statement-breakpoint
ALTER TABLE `roles` MODIFY COLUMN `workspace_id` char(36) NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_roles` MODIFY COLUMN `workspace_id` char(36) NOT NULL;
--> statement-breakpoint
ALTER TABLE `boards` MODIFY COLUMN `workspace_id` char(36) NOT NULL;
--> statement-breakpoint
ALTER TABLE `announcements` MODIFY COLUMN `workspace_id` char(36) NOT NULL;
--> statement-breakpoint
ALTER TABLE `thread_conversations` MODIFY COLUMN `workspace_id` char(36) NOT NULL;
--> statement-breakpoint
ALTER TABLE `activity_logs` MODIFY COLUMN `workspace_id` char(36) NOT NULL;
--> statement-breakpoint
ALTER TABLE `invites` ADD CONSTRAINT `invites_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `email_notification_deliveries` ADD CONSTRAINT `email_notification_deliveries_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `calendar_feed_tokens` ADD CONSTRAINT `calendar_feed_tokens_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `bug_reports` ADD CONSTRAINT `bug_reports_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `roles` ADD CONSTRAINT `roles_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `boards` ADD CONSTRAINT `boards_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `thread_conversations` ADD CONSTRAINT `thread_conversations_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `roles` DROP INDEX `roles_name_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_roles_workspace_name_unique` ON `roles` (`workspace_id`,`name`);
--> statement-breakpoint
DROP INDEX `idx_roles_priority` ON `roles`;
--> statement-breakpoint
CREATE INDEX `idx_roles_priority` ON `roles` (`workspace_id`,`priority`);
--> statement-breakpoint
ALTER TABLE `boards` DROP INDEX `idx_boards_name_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_boards_workspace_name_unique` ON `boards` (`workspace_id`,`name`);
--> statement-breakpoint
CREATE INDEX `idx_boards_workspace_archived` ON `boards` (`workspace_id`,`archived_at`);
--> statement-breakpoint
ALTER TABLE `user_roles` DROP PRIMARY KEY, ADD PRIMARY KEY (`workspace_id`,`user_id`,`role_id`);
--> statement-breakpoint
CREATE INDEX `idx_user_roles_workspace_user` ON `user_roles` (`workspace_id`,`user_id`);
--> statement-breakpoint
DROP INDEX `idx_email_deliveries_user_digest_unique` ON `email_notification_deliveries`;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_email_deliveries_user_digest_unique` ON `email_notification_deliveries` (`workspace_id`,`user_id`,`kind`,`digest_date`,`digest_window`);
--> statement-breakpoint
CREATE INDEX `idx_calendar_feed_tokens_workspace_user_feed` ON `calendar_feed_tokens` (`workspace_id`,`user_id`,`feed_type`,`revoked_at`);
--> statement-breakpoint
DROP INDEX `idx_thread_conversations_last_message_at` ON `thread_conversations`;
--> statement-breakpoint
CREATE INDEX `idx_thread_conversations_last_message_at` ON `thread_conversations` (`workspace_id`,`last_message_at`);
--> statement-breakpoint
CREATE INDEX `idx_thread_conversations_workspace_type` ON `thread_conversations` (`workspace_id`,`type`);
--> statement-breakpoint
DROP INDEX `idx_activity_logs_created_at` ON `activity_logs`;
--> statement-breakpoint
CREATE INDEX `idx_activity_logs_created_at` ON `activity_logs` (`workspace_id`,`created_at`);
