-- Existing users already know the app; only new signups after the tour feature should see it.
UPDATE "AppSettings" SET "completedAppTour" = true;
