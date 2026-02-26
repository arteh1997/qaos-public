-- Migration 060: Remove introductory pricing
-- Intro pricing has been removed; all stores now pay standard rates.

ALTER TABLE subscriptions DROP COLUMN IF EXISTS is_introductory;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS original_amount;
