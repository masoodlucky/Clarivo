-- Clarivo — Supabase Storage setup. Run once in Supabase Dashboard → SQL Editor.
--
-- Creates a PRIVATE bucket for report files. Do NOT add any policies on
-- storage.objects for this bucket: all access goes through the `report-files`
-- Edge Function, which checks Firebase login + tenant membership and hands out
-- short-lived signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reports',
  'reports',
  false,
  26214400, -- 25 MB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
