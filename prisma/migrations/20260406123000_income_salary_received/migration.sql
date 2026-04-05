-- Track whether company salary has been received vs still expected.
ALTER TABLE "Income" ADD COLUMN "received" BOOLEAN NOT NULL DEFAULT false;
