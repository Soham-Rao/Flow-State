CREATE TABLE `board_member_permissions` (
	`board_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`permission` enum('manage_workspace','manage_roles','invite_users','remove_users','view_activity_logs','view_boards','create_boards','edit_boards','delete_boards','manage_lists','create_cards','edit_cards','delete_cards_any','delete_cards_own','assign_members','set_due_dates','manage_checklists','upload_files','manage_labels','comment','edit_comments','delete_comments','react','mention_users','mention_roles','view_threads','create_threads','reply_threads','delete_threads','pin_threads','dm_read','dm_write','dm_encrypt','channel_read','channel_write','channel_edit','channel_members_add','channel_members_remove','channel_manage_overrides','channel_delete','view_settings','send_announcements','view_all_due_date_reminders','view_all_boards') NOT NULL,
	`access` enum('allow','deny') NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `board_member_permissions_board_id_user_id_permission_pk` PRIMARY KEY(`board_id`,`user_id`,`permission`)
);
--> statement-breakpoint
CREATE TABLE `board_members` (
	`board_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`role` varchar(64) NOT NULL DEFAULT 'member',
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `board_members_board_id_user_id_pk` PRIMARY KEY(`board_id`,`user_id`)
);
--> statement-breakpoint
ALTER TABLE `role_permissions` MODIFY COLUMN `permission` enum('manage_workspace','manage_roles','invite_users','remove_users','view_activity_logs','view_boards','create_boards','edit_boards','delete_boards','manage_lists','create_cards','edit_cards','delete_cards_any','delete_cards_own','assign_members','set_due_dates','manage_checklists','upload_files','manage_labels','comment','edit_comments','delete_comments','react','mention_users','mention_roles','view_threads','create_threads','reply_threads','delete_threads','pin_threads','dm_read','dm_write','dm_encrypt','channel_read','channel_write','channel_edit','channel_members_add','channel_members_remove','channel_manage_overrides','channel_delete','view_settings','send_announcements','view_all_due_date_reminders','view_all_boards') NOT NULL;--> statement-breakpoint
ALTER TABLE `role_scope_overrides` MODIFY COLUMN `permission` enum('manage_workspace','manage_roles','invite_users','remove_users','view_activity_logs','view_boards','create_boards','edit_boards','delete_boards','manage_lists','create_cards','edit_cards','delete_cards_any','delete_cards_own','assign_members','set_due_dates','manage_checklists','upload_files','manage_labels','comment','edit_comments','delete_comments','react','mention_users','mention_roles','view_threads','create_threads','reply_threads','delete_threads','pin_threads','dm_read','dm_write','dm_encrypt','channel_read','channel_write','channel_edit','channel_members_add','channel_members_remove','channel_manage_overrides','channel_delete','view_settings','send_announcements','view_all_due_date_reminders','view_all_boards') NOT NULL;--> statement-breakpoint
ALTER TABLE `thread_member_permissions` MODIFY COLUMN `permission` enum('manage_workspace','manage_roles','invite_users','remove_users','view_activity_logs','view_boards','create_boards','edit_boards','delete_boards','manage_lists','create_cards','edit_cards','delete_cards_any','delete_cards_own','assign_members','set_due_dates','manage_checklists','upload_files','manage_labels','comment','edit_comments','delete_comments','react','mention_users','mention_roles','view_threads','create_threads','reply_threads','delete_threads','pin_threads','dm_read','dm_write','dm_encrypt','channel_read','channel_write','channel_edit','channel_members_add','channel_members_remove','channel_manage_overrides','channel_delete','view_settings','send_announcements','view_all_due_date_reminders','view_all_boards') NOT NULL;--> statement-breakpoint
ALTER TABLE `board_member_permissions` ADD CONSTRAINT `board_member_permissions_board_id_boards_id_fk` FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `board_member_permissions` ADD CONSTRAINT `board_member_permissions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `board_members` ADD CONSTRAINT `board_members_board_id_boards_id_fk` FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `board_members` ADD CONSTRAINT `board_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_board_member_permissions_board_id` ON `board_member_permissions` (`board_id`);--> statement-breakpoint
CREATE INDEX `idx_board_member_permissions_user_id` ON `board_member_permissions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_board_members_board_id` ON `board_members` (`board_id`);--> statement-breakpoint
CREATE INDEX `idx_board_members_user_id` ON `board_members` (`user_id`);