-- G-Pay: face-scan step in KYC registration.
--
-- Before an account is accepted a member must scan their face with the device
-- camera (a liveness/identity selfie). The captured image is stored in the same
-- private "slips" bucket under the member's own folder (like the KPay slip);
-- this column holds only the storage path. Admins view it when reviewing an
-- account, alongside the NRC and payment slip.

alter table public.gpay_accounts
  add column if not exists face_path text
    check (face_path is null or char_length(face_path) <= 500);

comment on column public.gpay_accounts.face_path is
  'Storage path (private "slips" bucket) of the KYC face-scan selfie.';
