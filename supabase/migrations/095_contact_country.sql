-- 095_contact_country.sql — Add country column to contacts

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS country TEXT;
