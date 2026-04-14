CREATE TABLE `settlement_adjustments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settlementId` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`currency` enum('SEK','EUR') NOT NULL,
	`comment` text NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `settlement_adjustments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `settlement_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settlementId` int NOT NULL,
	`participantName` varchar(255) NOT NULL,
	`participantEmail` varchar(320),
	`calendarName` varchar(255) NOT NULL,
	`courseType` enum('intro','diplo','cert','vidare') NOT NULL,
	`courseDate` varchar(10),
	`affiliateCode` varchar(64),
	`paidInclVat` decimal(12,2) NOT NULL DEFAULT '0',
	`netExclVat` decimal(12,2) NOT NULL DEFAULT '0',
	`transactionFee` decimal(12,2) NOT NULL DEFAULT '0',
	`faMargin` decimal(12,2) NOT NULL DEFAULT '0',
	`affiliateDeduction` decimal(12,2) NOT NULL DEFAULT '0',
	`payout` decimal(12,2) NOT NULL DEFAULT '0',
	`missingAmount` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `settlement_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `settlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userType` enum('course_leader','affiliate') NOT NULL,
	`periodYear` int NOT NULL,
	`periodMonth` int NOT NULL,
	`currency` enum('SEK','EUR') NOT NULL,
	`status` enum('pending','approved','amended') NOT NULL DEFAULT 'pending',
	`totalPaidInclVat` decimal(12,2) NOT NULL DEFAULT '0',
	`totalNetExclVat` decimal(12,2) NOT NULL DEFAULT '0',
	`totalTransactionFee` decimal(12,2) NOT NULL DEFAULT '0',
	`totalFaMargin` decimal(12,2) NOT NULL DEFAULT '0',
	`totalAffiliateDeduction` decimal(12,2) NOT NULL DEFAULT '0',
	`totalAdjustments` decimal(12,2) NOT NULL DEFAULT '0',
	`totalPayout` decimal(12,2) NOT NULL DEFAULT '0',
	`participantCount` int NOT NULL DEFAULT 0,
	`amendedFromId` int,
	`approvedAt` timestamp,
	`approvedBy` int,
	`notificationSentAt` timestamp,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settlements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `dashboard_users` ADD `invoiceReference` varchar(128);