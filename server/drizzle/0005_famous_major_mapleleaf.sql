CREATE TABLE `bug_reports` (
	`id` char(36) NOT NULL,
	`reporter_id` char(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`message` text NOT NULL,
	`page_path` varchar(512),
	`user_agent` varchar(512),
	`status` enum('open','triaged','closed') NOT NULL DEFAULT 'open',
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `bug_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `bug_reports` ADD CONSTRAINT `bug_reports_reporter_id_users_id_fk` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_bug_reports_reporter_id` ON `bug_reports` (`reporter_id`);--> statement-breakpoint
CREATE INDEX `idx_bug_reports_status_created` ON `bug_reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_bug_reports_created_at` ON `bug_reports` (`created_at`);