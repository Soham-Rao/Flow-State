ALTER TABLE `thread_members` DROP FOREIGN KEY `thread_members_conversation_id_thread_conversations_id_fk`;
--> statement-breakpoint
ALTER TABLE `thread_messages` DROP FOREIGN KEY `thread_messages_conversation_id_thread_conversations_id_fk`;
