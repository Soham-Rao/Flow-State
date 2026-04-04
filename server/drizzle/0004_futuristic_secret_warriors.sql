CREATE INDEX `idx_activity_logs_board_created` ON `activity_logs` (`board_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_activity_logs_type_created` ON `activity_logs` (`type`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_announcement_recipients_user_seen_created` ON `announcement_recipients` (`user_id`,`seen_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_cards_created_by` ON `cards` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_comment_mentions_user_seen_created` ON `comment_mentions` (`user_id`,`seen_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_thread_mentions_user_seen_created` ON `thread_mentions` (`mentioned_user_id`,`seen_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_thread_messages_conversation_created` ON `thread_messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_thread_replies_parent_created` ON `thread_replies` (`parent_message_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_thread_replies_author_id` ON `thread_replies` (`author_id`);--> statement-breakpoint
CREATE INDEX `idx_thread_reply_mentions_user_seen_created` ON `thread_reply_mentions` (`mentioned_user_id`,`seen_at`,`created_at`);