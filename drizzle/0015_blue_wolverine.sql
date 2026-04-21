CREATE TABLE `guide_content` (
	`id` int AUTO_INCREMENT NOT NULL,
	`presentationId` varchar(64) NOT NULL,
	`slideId` varchar(64) NOT NULL,
	`fieldKey` varchar(128) NOT NULL,
	`content` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` varchar(255),
	CONSTRAINT `guide_content_id` PRIMARY KEY(`id`)
);
