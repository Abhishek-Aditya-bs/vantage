CREATE TABLE `spaces` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`host_member_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_active_at` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
