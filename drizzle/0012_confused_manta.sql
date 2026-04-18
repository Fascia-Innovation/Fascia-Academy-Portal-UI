CREATE TABLE `certificate_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseType` enum('intro','diplo','cert','vidare') NOT NULL,
	`language` enum('sv','en') NOT NULL DEFAULT 'sv',
	`title` varchar(255) NOT NULL,
	`courseLabel` varchar(255) NOT NULL,
	`bodyText` text NOT NULL,
	`bulletPoints` text,
	`instructorName` varchar(255) NOT NULL DEFAULT 'Ivar Bohlin',
	`instructorTitle` varchar(255) NOT NULL DEFAULT 'Ansvarig lärare Ivar Bohlin',
	`faLogoUrl` varchar(1024),
	`atlasLogoUrl` varchar(1024),
	`emailSubject` varchar(500) NOT NULL,
	`emailBody` text NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `certificate_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `certificates` ADD `uuid` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `certificates` ADD `templateId` int;--> statement-breakpoint
ALTER TABLE `certificates` ADD `emailSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_uuid_unique` UNIQUE(`uuid`);