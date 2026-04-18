CREATE TABLE `course_leader_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseDateId` int NOT NULL,
	`authorId` int NOT NULL,
	`subject` varchar(500) NOT NULL,
	`body` text NOT NULL,
	`status` enum('draft','pending_approval','approved','rejected') NOT NULL DEFAULT 'draft',
	`adminNote` text,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`sentAt` timestamp,
	`recipientCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `course_leader_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `participant_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseDateId` int NOT NULL,
	`ghlAppointmentId` varchar(64) NOT NULL,
	`ghlContactId` varchar(64) NOT NULL,
	`participantName` varchar(255) NOT NULL,
	`participantPhone` varchar(64),
	`participantEmail` varchar(320),
	`status` enum('showed','noshow','confirmed','cancelled') NOT NULL,
	`snapshotAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `participant_snapshots_id` PRIMARY KEY(`id`)
);
