-- Structured lost-reason capture: a sales rep marking a prospect "lost" now
-- picks from a fixed set of categories (for later analytics grouping) plus
-- an optional free-text note, instead of nothing being recorded at all.

create type prospect_lost_reason as enum (
  'not_a_fit',
  'budget_pricing',
  'no_response',
  'chose_competitor',
  'not_ready_timing',
  'invalid_contact_details',
  'other'
);

alter table prospects add column lost_reason prospect_lost_reason;
alter table prospects add column lost_reason_note text;
