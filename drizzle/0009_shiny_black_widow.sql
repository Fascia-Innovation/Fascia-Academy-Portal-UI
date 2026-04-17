ALTER TABLE `course_dates` ADD `status` enum('approved','pending_approval','pending_cancellation','pending_reschedule','needs_revision','cancelled') DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE `course_dates` ADD `submittedBy` int;--> statement-breakpoint
ALTER TABLE `course_dates` ADD `adminMessage` text;--> statement-breakpoint
ALTER TABLE `course_dates` ADD `leaderMessage` text;--> statement-breakpoint
ALTER TABLE `course_dates` ADD `changeLog` text;--> statement-breakpoint
ALTER TABLE `course_dates` ADD `rescheduleNewStart` timestamp;--> statement-breakpoint
ALTER TABLE `course_dates` ADD `rescheduleNewEnd` timestamp;--> statement-breakpoint
ALTER TABLE `course_dates` ADD `rescheduleNewAdditionalDays` text;--> statement-breakpoint
ALTER TABLE `dashboard_users` ADD `canExamineExams` boolean DEFAULT false NOT NULL;