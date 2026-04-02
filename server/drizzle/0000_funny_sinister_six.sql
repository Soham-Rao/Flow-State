CREATE TABLE `activity_logs` (
	`id` char(36) NOT NULL,
	`type` varchar(255) NOT NULL,
	`actor_id` char(36) NOT NULL,
	`board_id` char(36),
	`list_id` char(36),
	`card_id` char(36),
	`thread_conversation_id` char(36),
	`thread_message_id` char(36),
	`thread_reply_id` char(36),
	`mentioned_user_id` char(36),
	`metadata` text,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `announcement_recipients` (
	`announcement_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`seen_at` datetime(3),
	CONSTRAINT `announcement_recipients_announcement_id_user_id_pk` PRIMARY KEY(`announcement_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` char(36) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`audience` text,
	`created_by` char(36) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` char(36) NOT NULL,
	`card_id` char(36) NOT NULL,
	`original_name` varchar(255) NOT NULL,
	`stored_name` varchar(255) NOT NULL,
	`mime_type` varchar(255),
	`size` int NOT NULL DEFAULT 0,
	`storage_path` varchar(1024) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `boards` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`background` varchar(255) NOT NULL DEFAULT 'teal-gradient',
	`retention_mode` enum('attachments_only','card_and_attachments') NOT NULL DEFAULT 'card_and_attachments',
	`retention_minutes` int NOT NULL DEFAULT 10080,
	`archive_retention_minutes` int NOT NULL DEFAULT 10080,
	`archived_at` datetime(3),
	`created_by` char(36) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `boards_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_boards_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `card_assignees` (
	`card_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `card_assignees_card_id_user_id_pk` PRIMARY KEY(`card_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `card_labels` (
	`card_id` char(36) NOT NULL,
	`label_id` char(36) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `card_labels_card_id_label_id_pk` PRIMARY KEY(`card_id`,`label_id`)
);
--> statement-breakpoint
CREATE TABLE `cards` (
	`id` char(36) NOT NULL,
	`list_id` char(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`cover_color` enum('none','slate','blue','teal','green','amber','orange','red','purple','pink'),
	`due_date` datetime(3),
	`position` int NOT NULL DEFAULT 0,
	`created_by` char(36) NOT NULL,
	`archived_at` datetime(3),
	`done_entered_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `checklist_items` (
	`id` char(36) NOT NULL,
	`checklist_id` char(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`is_done` boolean NOT NULL DEFAULT false,
	`position` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `checklist_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `checklists` (
	`id` char(36) NOT NULL,
	`card_id` char(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `checklists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `comment_mentions` (
	`comment_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`seen_at` datetime(3),
	CONSTRAINT `comment_mentions_comment_id_user_id_pk` PRIMARY KEY(`comment_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `comment_reactions` (
	`comment_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`emoji` varchar(64) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `comment_reactions_comment_id_user_id_emoji_pk` PRIMARY KEY(`comment_id`,`user_id`,`emoji`)
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` char(36) NOT NULL,
	`board_id` char(36) NOT NULL,
	`list_id` char(36),
	`card_id` char(36),
	`author_id` char(36) NOT NULL,
	`body` text NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invite_roles` (
	`invite_id` char(36) NOT NULL,
	`role_id` char(36) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `invite_roles_invite_id_role_id_pk` PRIMARY KEY(`invite_id`,`role_id`)
);
--> statement-breakpoint
CREATE TABLE `invites` (
	`id` char(36) NOT NULL,
	`token` varchar(255) NOT NULL,
	`email` varchar(255),
	`role` enum('admin','member','guest') NOT NULL DEFAULT 'guest',
	`created_by` char(36) NOT NULL,
	`accepted_by` char(36),
	`accepted_at` datetime(3),
	`revoked_at` datetime(3),
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `invites_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `labels` (
	`id` char(36) NOT NULL,
	`board_id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`color` enum('slate','blue','teal','green','amber','orange','red','purple','pink') NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `labels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lists` (
	`id` char(36) NOT NULL,
	`board_id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`is_done_list` boolean NOT NULL DEFAULT false,
	`archived_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `lists_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_lists_board_name_active` UNIQUE(`board_id`,`name`,`archived_at`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` char(36) NOT NULL,
	`permission` enum('manage_workspace','manage_roles','invite_users','remove_users','view_activity_logs','view_boards','create_boards','edit_boards','delete_boards','manage_lists','create_cards','edit_cards','delete_cards_any','delete_cards_own','assign_members','set_due_dates','manage_checklists','upload_files','manage_labels','comment','edit_comments','delete_comments','react','mention_users','mention_roles','view_threads','create_threads','reply_threads','delete_threads','pin_threads','dm_read','dm_write','dm_encrypt','channel_read','channel_write','channel_edit','channel_members_add','channel_members_remove','channel_manage_overrides','channel_delete','view_settings','send_announcements') NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `role_permissions_role_id_permission_pk` PRIMARY KEY(`role_id`,`permission`)
);
--> statement-breakpoint
CREATE TABLE `role_scope_overrides` (
	`role_id` char(36) NOT NULL,
	`scope_type` enum('global','board','section','card') NOT NULL,
	`scope_id` char(36) NOT NULL,
	`permission` enum('manage_workspace','manage_roles','invite_users','remove_users','view_activity_logs','view_boards','create_boards','edit_boards','delete_boards','manage_lists','create_cards','edit_cards','delete_cards_any','delete_cards_own','assign_members','set_due_dates','manage_checklists','upload_files','manage_labels','comment','edit_comments','delete_comments','react','mention_users','mention_roles','view_threads','create_threads','reply_threads','delete_threads','pin_threads','dm_read','dm_write','dm_encrypt','channel_read','channel_write','channel_edit','channel_members_add','channel_members_remove','channel_manage_overrides','channel_delete','view_settings','send_announcements') NOT NULL,
	`access` enum('allow','deny') NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `role_scope_overrides_role_id_scope_type_scope_id_permission_pk` PRIMARY KEY(`role_id`,`scope_type`,`scope_id`,`permission`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`color` varchar(32) NOT NULL,
	`priority` int NOT NULL DEFAULT 1,
	`mentionable` boolean NOT NULL DEFAULT false,
	`is_system` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `thread_attachments` (
	`id` char(36) NOT NULL,
	`message_id` char(36) NOT NULL,
	`original_name` varchar(255) NOT NULL,
	`mime_type` varchar(255),
	`size` int NOT NULL DEFAULT 0,
	`storage_path` varchar(1024) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `thread_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `thread_conversations` (
	`id` char(36) NOT NULL,
	`type` enum('dm','channel') NOT NULL,
	`name` varchar(255),
	`description` text,
	`created_by` char(36),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	`last_message_at` datetime(3),
	CONSTRAINT `thread_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `thread_member_permissions` (
	`conversation_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`permission` enum('manage_workspace','manage_roles','invite_users','remove_users','view_activity_logs','view_boards','create_boards','edit_boards','delete_boards','manage_lists','create_cards','edit_cards','delete_cards_any','delete_cards_own','assign_members','set_due_dates','manage_checklists','upload_files','manage_labels','comment','edit_comments','delete_comments','react','mention_users','mention_roles','view_threads','create_threads','reply_threads','delete_threads','pin_threads','dm_read','dm_write','dm_encrypt','channel_read','channel_write','channel_edit','channel_members_add','channel_members_remove','channel_manage_overrides','channel_delete','view_settings','send_announcements') NOT NULL,
	`access` enum('allow','deny') NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `thread_member_permissions_conversation_id_user_id_permission_pk` PRIMARY KEY(`conversation_id`,`user_id`,`permission`)
);
--> statement-breakpoint
CREATE TABLE `thread_members` (
	`conversation_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`role` enum('member','admin') NOT NULL DEFAULT 'member',
	`created_at` datetime(3) NOT NULL,
	`last_read_at` datetime(3),
	CONSTRAINT `thread_members_conversation_id_user_id_pk` PRIMARY KEY(`conversation_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `thread_mentions` (
	`id` char(36) NOT NULL,
	`message_id` char(36) NOT NULL,
	`mentioned_user_id` char(36) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`seen_at` datetime(3),
	CONSTRAINT `thread_mentions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `thread_message_deletions` (
	`message_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`deleted_at` datetime(3) NOT NULL,
	CONSTRAINT `thread_message_deletions_message_id_user_id_pk` PRIMARY KEY(`message_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `thread_message_reactions` (
	`message_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`emoji` varchar(64) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `thread_message_reactions_message_id_user_id_emoji_pk` PRIMARY KEY(`message_id`,`user_id`,`emoji`)
);
--> statement-breakpoint
CREATE TABLE `thread_messages` (
	`id` char(36) NOT NULL,
	`conversation_id` char(36) NOT NULL,
	`author_id` char(36) NOT NULL,
	`body` text,
	`body_encrypted` text,
	`body_format` varchar(32) NOT NULL DEFAULT 'plain',
	`encryption_version` int NOT NULL DEFAULT 1,
	`is_forwarded` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	`deleted_at` datetime(3),
	CONSTRAINT `thread_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `thread_replies` (
	`id` char(36) NOT NULL,
	`parent_message_id` char(36) NOT NULL,
	`author_id` char(36) NOT NULL,
	`body` text,
	`body_encrypted` text,
	`body_format` varchar(32) NOT NULL DEFAULT 'plain',
	`encryption_version` int NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	`deleted_at` datetime(3),
	CONSTRAINT `thread_replies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `thread_reply_attachments` (
	`id` char(36) NOT NULL,
	`reply_id` char(36) NOT NULL,
	`original_name` varchar(255) NOT NULL,
	`mime_type` varchar(255),
	`size` int NOT NULL DEFAULT 0,
	`storage_path` varchar(1024) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `thread_reply_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `thread_reply_deletions` (
	`reply_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`deleted_at` datetime(3) NOT NULL,
	CONSTRAINT `thread_reply_deletions_reply_id_user_id_pk` PRIMARY KEY(`reply_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `thread_reply_mentions` (
	`id` char(36) NOT NULL,
	`reply_id` char(36) NOT NULL,
	`mentioned_user_id` char(36) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`seen_at` datetime(3),
	CONSTRAINT `thread_reply_mentions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `thread_reply_reactions` (
	`reply_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`emoji` varchar(64) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `thread_reply_reactions_reply_id_user_id_emoji_pk` PRIMARY KEY(`reply_id`,`user_id`,`emoji`)
);
--> statement-breakpoint
CREATE TABLE `thread_reply_voice_notes` (
	`id` char(36) NOT NULL,
	`reply_id` char(36) NOT NULL,
	`duration_sec` int NOT NULL DEFAULT 0,
	`storage_path` varchar(1024) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `thread_reply_voice_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `thread_voice_notes` (
	`id` char(36) NOT NULL,
	`message_id` char(36) NOT NULL,
	`duration_sec` int NOT NULL DEFAULT 0,
	`storage_path` varchar(1024) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `thread_voice_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` char(36) NOT NULL,
	`role_id` char(36) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `user_roles_user_id_role_id_pk` PRIMARY KEY(`user_id`,`role_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`username` varchar(255),
	`display_name` varchar(255),
	`bio` text,
	`age` int,
	`date_of_birth` datetime(3),
	`password_hash` varchar(255) NOT NULL,
	`role` enum('admin','member','guest') NOT NULL DEFAULT 'guest',
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`),
	CONSTRAINT `idx_users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_actor_id_users_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_board_id_boards_id_fk` FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_list_id_lists_id_fk` FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_card_id_cards_id_fk` FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_thread_conversation_id_thread_conversations_id_fk` FOREIGN KEY (`thread_conversation_id`) REFERENCES `thread_conversations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_thread_message_id_thread_messages_id_fk` FOREIGN KEY (`thread_message_id`) REFERENCES `thread_messages`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_thread_reply_id_thread_replies_id_fk` FOREIGN KEY (`thread_reply_id`) REFERENCES `thread_replies`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_mentioned_user_id_users_id_fk` FOREIGN KEY (`mentioned_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `announcement_recipients` ADD CONSTRAINT `announcement_recipients_announcement_id_announcements_id_fk` FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `announcement_recipients` ADD CONSTRAINT `announcement_recipients_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attachments` ADD CONSTRAINT `attachments_card_id_cards_id_fk` FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `boards` ADD CONSTRAINT `boards_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `card_assignees` ADD CONSTRAINT `card_assignees_card_id_cards_id_fk` FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `card_assignees` ADD CONSTRAINT `card_assignees_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `card_labels` ADD CONSTRAINT `card_labels_card_id_cards_id_fk` FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `card_labels` ADD CONSTRAINT `card_labels_label_id_labels_id_fk` FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cards` ADD CONSTRAINT `cards_list_id_lists_id_fk` FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cards` ADD CONSTRAINT `cards_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checklist_items` ADD CONSTRAINT `checklist_items_checklist_id_checklists_id_fk` FOREIGN KEY (`checklist_id`) REFERENCES `checklists`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checklists` ADD CONSTRAINT `checklists_card_id_cards_id_fk` FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comment_mentions` ADD CONSTRAINT `comment_mentions_comment_id_comments_id_fk` FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comment_mentions` ADD CONSTRAINT `comment_mentions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comment_reactions` ADD CONSTRAINT `comment_reactions_comment_id_comments_id_fk` FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comment_reactions` ADD CONSTRAINT `comment_reactions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comments` ADD CONSTRAINT `comments_board_id_boards_id_fk` FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comments` ADD CONSTRAINT `comments_list_id_lists_id_fk` FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comments` ADD CONSTRAINT `comments_card_id_cards_id_fk` FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comments` ADD CONSTRAINT `comments_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invite_roles` ADD CONSTRAINT `invite_roles_invite_id_invites_id_fk` FOREIGN KEY (`invite_id`) REFERENCES `invites`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invite_roles` ADD CONSTRAINT `invite_roles_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invites` ADD CONSTRAINT `invites_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invites` ADD CONSTRAINT `invites_accepted_by_users_id_fk` FOREIGN KEY (`accepted_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `labels` ADD CONSTRAINT `labels_board_id_boards_id_fk` FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lists` ADD CONSTRAINT `lists_board_id_boards_id_fk` FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_scope_overrides` ADD CONSTRAINT `role_scope_overrides_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_attachments` ADD CONSTRAINT `thread_attachments_message_id_thread_messages_id_fk` FOREIGN KEY (`message_id`) REFERENCES `thread_messages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_conversations` ADD CONSTRAINT `thread_conversations_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_member_permissions` ADD CONSTRAINT `fk_thread_member_permissions_conv` FOREIGN KEY (`conversation_id`) REFERENCES `thread_conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_member_permissions` ADD CONSTRAINT `thread_member_permissions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_members` ADD CONSTRAINT `thread_members_conversation_id_thread_conversations_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `thread_conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_members` ADD CONSTRAINT `thread_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_mentions` ADD CONSTRAINT `thread_mentions_message_id_thread_messages_id_fk` FOREIGN KEY (`message_id`) REFERENCES `thread_messages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_mentions` ADD CONSTRAINT `thread_mentions_mentioned_user_id_users_id_fk` FOREIGN KEY (`mentioned_user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_message_deletions` ADD CONSTRAINT `thread_message_deletions_message_id_thread_messages_id_fk` FOREIGN KEY (`message_id`) REFERENCES `thread_messages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_message_deletions` ADD CONSTRAINT `thread_message_deletions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_message_reactions` ADD CONSTRAINT `thread_message_reactions_message_id_thread_messages_id_fk` FOREIGN KEY (`message_id`) REFERENCES `thread_messages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_message_reactions` ADD CONSTRAINT `thread_message_reactions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_messages` ADD CONSTRAINT `thread_messages_conversation_id_thread_conversations_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `thread_conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_messages` ADD CONSTRAINT `thread_messages_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_replies` ADD CONSTRAINT `thread_replies_parent_message_id_thread_messages_id_fk` FOREIGN KEY (`parent_message_id`) REFERENCES `thread_messages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_replies` ADD CONSTRAINT `thread_replies_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_reply_attachments` ADD CONSTRAINT `thread_reply_attachments_reply_id_thread_replies_id_fk` FOREIGN KEY (`reply_id`) REFERENCES `thread_replies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_reply_deletions` ADD CONSTRAINT `thread_reply_deletions_reply_id_thread_replies_id_fk` FOREIGN KEY (`reply_id`) REFERENCES `thread_replies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_reply_deletions` ADD CONSTRAINT `thread_reply_deletions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_reply_mentions` ADD CONSTRAINT `thread_reply_mentions_reply_id_thread_replies_id_fk` FOREIGN KEY (`reply_id`) REFERENCES `thread_replies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_reply_mentions` ADD CONSTRAINT `thread_reply_mentions_mentioned_user_id_users_id_fk` FOREIGN KEY (`mentioned_user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_reply_reactions` ADD CONSTRAINT `thread_reply_reactions_reply_id_thread_replies_id_fk` FOREIGN KEY (`reply_id`) REFERENCES `thread_replies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_reply_reactions` ADD CONSTRAINT `thread_reply_reactions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_reply_voice_notes` ADD CONSTRAINT `thread_reply_voice_notes_reply_id_thread_replies_id_fk` FOREIGN KEY (`reply_id`) REFERENCES `thread_replies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `thread_voice_notes` ADD CONSTRAINT `thread_voice_notes_message_id_thread_messages_id_fk` FOREIGN KEY (`message_id`) REFERENCES `thread_messages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_activity_logs_board_id` ON `activity_logs` (`board_id`);--> statement-breakpoint
CREATE INDEX `idx_activity_logs_actor_id` ON `activity_logs` (`actor_id`);--> statement-breakpoint
CREATE INDEX `idx_activity_logs_created_at` ON `activity_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_activity_logs_thread_conversation_id` ON `activity_logs` (`thread_conversation_id`);--> statement-breakpoint
CREATE INDEX `idx_attachments_card_id` ON `attachments` (`card_id`);--> statement-breakpoint
CREATE INDEX `idx_card_assignees_card_id` ON `card_assignees` (`card_id`);--> statement-breakpoint
CREATE INDEX `idx_card_assignees_user_id` ON `card_assignees` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_card_labels_card_id` ON `card_labels` (`card_id`);--> statement-breakpoint
CREATE INDEX `idx_card_labels_label_id` ON `card_labels` (`label_id`);--> statement-breakpoint
CREATE INDEX `idx_cards_list_id` ON `cards` (`list_id`);--> statement-breakpoint
CREATE INDEX `idx_cards_done_entered_at` ON `cards` (`done_entered_at`);--> statement-breakpoint
CREATE INDEX `idx_checklist_items_checklist_id` ON `checklist_items` (`checklist_id`);--> statement-breakpoint
CREATE INDEX `idx_checklists_card_id` ON `checklists` (`card_id`);--> statement-breakpoint
CREATE INDEX `idx_comment_mentions_user_id` ON `comment_mentions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_comments_board_id` ON `comments` (`board_id`);--> statement-breakpoint
CREATE INDEX `idx_comments_list_id` ON `comments` (`list_id`);--> statement-breakpoint
CREATE INDEX `idx_comments_card_id` ON `comments` (`card_id`);--> statement-breakpoint
CREATE INDEX `idx_invite_roles_invite_id` ON `invite_roles` (`invite_id`);--> statement-breakpoint
CREATE INDEX `idx_invite_roles_role_id` ON `invite_roles` (`role_id`);--> statement-breakpoint
CREATE INDEX `idx_invites_email` ON `invites` (`email`);--> statement-breakpoint
CREATE INDEX `idx_invites_expires_at` ON `invites` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_labels_board_id` ON `labels` (`board_id`);--> statement-breakpoint
CREATE INDEX `idx_lists_board_id` ON `lists` (`board_id`);--> statement-breakpoint
CREATE INDEX `idx_role_permissions_role_id` ON `role_permissions` (`role_id`);--> statement-breakpoint
CREATE INDEX `idx_role_scope_overrides_role_id` ON `role_scope_overrides` (`role_id`);--> statement-breakpoint
CREATE INDEX `idx_roles_priority` ON `roles` (`priority`);--> statement-breakpoint
CREATE INDEX `idx_thread_conversations_last_message_at` ON `thread_conversations` (`last_message_at`);--> statement-breakpoint
CREATE INDEX `idx_thread_member_permissions_conversation_id` ON `thread_member_permissions` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `idx_thread_member_permissions_user_id` ON `thread_member_permissions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_thread_members_conversation_id` ON `thread_members` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `idx_thread_members_user_id` ON `thread_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_thread_members_last_read_at` ON `thread_members` (`last_read_at`);--> statement-breakpoint
CREATE INDEX `idx_thread_mentions_user_id` ON `thread_mentions` (`mentioned_user_id`);--> statement-breakpoint
CREATE INDEX `idx_thread_message_deletions_message_id` ON `thread_message_deletions` (`message_id`);--> statement-breakpoint
CREATE INDEX `idx_thread_message_deletions_user_id` ON `thread_message_deletions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_thread_message_reactions_message_id` ON `thread_message_reactions` (`message_id`);--> statement-breakpoint
CREATE INDEX `idx_thread_messages_conversation_id` ON `thread_messages` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `idx_thread_messages_author_id` ON `thread_messages` (`author_id`);--> statement-breakpoint
CREATE INDEX `idx_thread_messages_created_at` ON `thread_messages` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_thread_replies_parent_message_id` ON `thread_replies` (`parent_message_id`);--> statement-breakpoint
CREATE INDEX `idx_thread_reply_deletions_reply_id` ON `thread_reply_deletions` (`reply_id`);--> statement-breakpoint
CREATE INDEX `idx_thread_reply_deletions_user_id` ON `thread_reply_deletions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_thread_reply_mentions_user_id` ON `thread_reply_mentions` (`mentioned_user_id`);--> statement-breakpoint
CREATE INDEX `idx_thread_reply_reactions_reply_id` ON `thread_reply_reactions` (`reply_id`);--> statement-breakpoint
CREATE INDEX `idx_user_roles_user_id` ON `user_roles` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_roles_role_id` ON `user_roles` (`role_id`);
