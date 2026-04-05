ALTER TABLE `thread_replies` ADD `reply_to_reply_id` char(36);--> statement-breakpoint
ALTER TABLE `thread_replies` ADD CONSTRAINT `fk_thread_replies_reply_to_reply` FOREIGN KEY (`reply_to_reply_id`) REFERENCES `thread_replies`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_thread_replies_reply_to_reply` ON `thread_replies` (`reply_to_reply_id`);