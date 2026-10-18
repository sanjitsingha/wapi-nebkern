-- ============================================================
-- Custom fields: a type, and whether a contact must have it.
--
-- field_type has always existed but only ever held 'text'. Settings →
-- Custom fields now offers four, and the contact editors draw the
-- matching input:
--   text      a text box
--   number    a number box; stored as its digits
--   dropdown  one of field_options.options (an array of strings)
--   date      a date picker; stored as YYYY-MM-DD
-- Values stay text in contact_custom_values whatever the type, so
-- segments, broadcasts variables and exports read them as before.
--
-- is_required marks a field every contact must have filled: the
-- contact editors won't save custom fields with one left empty.
-- ============================================================

ALTER TABLE custom_fields
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT false;

ALTER TABLE custom_fields DROP CONSTRAINT IF EXISTS custom_fields_field_type_check;
ALTER TABLE custom_fields
  ADD CONSTRAINT custom_fields_field_type_check
  CHECK (field_type IN ('text', 'number', 'dropdown', 'date'));
