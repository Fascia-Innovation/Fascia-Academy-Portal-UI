ALTER TABLE `certificates` ADD `status` enum('draft','sent') DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `certificates` ADD `sentAt` timestamp;--> statement-breakpoint
ALTER TABLE `certificates` ADD `sentBy` int;--> statement-breakpoint
ALTER TABLE `certificates` ADD `verificationCode` varchar(20);--> statement-breakpoint
ALTER TABLE `certificates` ADD `showedAt` timestamp;--> statement-breakpoint
ALTER TABLE `certificates` ADD `examPassedAt` timestamp;--> statement-breakpoint
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_verificationCode_unique` UNIQUE(`verificationCode`);