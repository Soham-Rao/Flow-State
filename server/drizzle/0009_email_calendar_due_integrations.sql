CREATE TABLE `user_notification_preferences` (
  `user_id` char(36) NOT NULL,
  `due_email_enabled` boolean NOT NULL DEFAULT true,
  `created_at` datetime(3) NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  CONSTRAINT `user_notification_preferences_user_id` PRIMARY KEY(`user_id`)
);--> statement-breakpoint
CREATE TABLE `email_notification_deliveries` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `kind` enum('assignee_due_digest','manager_due_digest') NOT NULL,
  `digest_date` varchar(10) NOT NULL,
  `digest_window` enum('morning','afternoon') NOT NULL,
  `recipient_email` varchar(255) NOT NULL,
  `item_count` int NOT NULL DEFAULT 0,
  `status` enum('sent','skipped','failed') NOT NULL,
  `error` text,
  `sent_at` datetime(3),
  `created_at` datetime(3) NOT NULL,
  CONSTRAINT `email_notification_deliveries_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE TABLE `calendar_feed_tokens` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `feed_type` enum('personal_due_dates','manager_due_dates') NOT NULL,
  `token` varchar(128) NOT NULL,
  `revoked_at` datetime(3),
  `created_at` datetime(3) NOT NULL,
  CONSTRAINT `calendar_feed_tokens_id` PRIMARY KEY(`id`),
  CONSTRAINT `idx_calendar_feed_tokens_token` UNIQUE(`token`)
);--> statement-breakpoint
ALTER TABLE `user_notification_preferences` ADD CONSTRAINT `user_notification_preferences_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_notification_deliveries` ADD CONSTRAINT `email_notification_deliveries_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `calendar_feed_tokens` ADD CONSTRAINT `calendar_feed_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_email_deliveries_user_digest_unique` ON `email_notification_deliveries` (`user_id`,`kind`,`digest_date`,`digest_window`);--> statement-breakpoint
CREATE INDEX `idx_email_deliveries_digest_status` ON `email_notification_deliveries` (`digest_date`,`status`);--> statement-breakpoint
CREATE INDEX `idx_email_deliveries_user_id` ON `email_notification_deliveries` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_calendar_feed_tokens_user_feed` ON `calendar_feed_tokens` (`user_id`,`feed_type`,`revoked_at`);
