CREATE TABLE `course_dates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ghlCalendarId` varchar(64) NOT NULL,
	`courseLeaderName` varchar(255) NOT NULL,
	`ghlUserId` varchar(64),
	`courseType` enum('intro','diplo','cert','vidare') NOT NULL,
	`language` enum('sv','en') NOT NULL DEFAULT 'sv',
	`city` varchar(255) NOT NULL,
	`country` varchar(64) NOT NULL DEFAULT 'Sweden',
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`maxSeats` int NOT NULL DEFAULT 12,
	`notes` text,
	`published` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `course_dates_id` PRIMARY KEY(`id`)
);
