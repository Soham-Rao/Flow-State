ALTER TABLE `thread_messages` ADD `reply_to_message_id` char(36);
--> statement-breakpoint
ALTER TABLE `thread_messages` ADD `reply_to_reply_id` char(36);
--> statement-breakpoint
CREATE INDEX `idx_thread_messages_reply_to_message` ON `thread_messages` (`reply_to_message_id`);
--> statement-breakpoint
CREATE INDEX `idx_thread_messages_reply_to_reply` ON `thread_messages` (`reply_to_reply_id`);
--> statement-breakpoint
ALTER TABLE `thread_messages` ADD CONSTRAINT `fk_thread_messages_reply_message` FOREIGN KEY (`reply_to_message_id`) REFERENCES `thread_messages`(`id`) ON DELETE set null ON UPDATE no action;
