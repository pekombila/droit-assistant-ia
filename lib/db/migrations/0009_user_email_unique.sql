ALTER TABLE "User" ALTER COLUMN "email" SET DATA TYPE varchar(254);--> statement-breakpoint
ALTER TABLE "User" ADD CONSTRAINT "User_email_unique" UNIQUE("email");
