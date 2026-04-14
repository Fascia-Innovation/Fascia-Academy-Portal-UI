CREATE TABLE `certificates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ghlContactId` varchar(64) NOT NULL,
	`contactName` varchar(255) NOT NULL,
	`contactEmail` varchar(320),
	`courseType` enum('intro','diplo','cert','vidare') NOT NULL,
	`language` enum('sv','en') NOT NULL DEFAULT 'sv',
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	`pdfUrl` varchar(1024),
	`issuedBy` int,
	`examId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `certificates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ghlContactId` varchar(64) NOT NULL,
	`contactName` varchar(255) NOT NULL,
	`contactEmail` varchar(320),
	`courseType` enum('diplo','cert') NOT NULL,
	`language` enum('sv','en') NOT NULL DEFAULT 'sv',
	`status` enum('pending','passed','failed') NOT NULL DEFAULT 'pending',
	`examinedBy` int,
	`examinedAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `exams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `course_dates` ADD `bookedSeats` int DEFAULT 0 NOT NULL;