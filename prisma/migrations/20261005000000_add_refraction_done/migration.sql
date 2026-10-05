-- Migration: add refractionDone to Visit
ALTER TABLE "Visit" ADD COLUMN "refractionDone" BOOLEAN NOT NULL DEFAULT false;
