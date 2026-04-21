CREATE TABLE `course_participant_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseDateId` int NOT NULL,
	`ghlAppointmentId` varchar(64) NOT NULL,
	`ghlContactId` varchar(64) NOT NULL,
	`firstName` varchar(255) NOT NULL DEFAULT '',
	`lastName` varchar(255) NOT NULL DEFAULT '',
	`phone` varchar(64),
	`email` varchar(320),
	`appointmentStatus` varchar(64) NOT NULL DEFAULT 'confirmed',
	`snapshotTakenAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `course_participant_snapshots_id` PRIMARY KEY(`id`)
);
