-- Vendor-cloud cameras (docs/tasks/VENDOR_CLOUD_CAMERA_INTEGRATION.md, PR 1).
--
-- A `vendor_cloud` camera is imported from an approved camera-vendor cloud
-- account (Hik-Connect etc.) — gwave stores a *reference* to the camera plus
-- an encrypted vendor token, never the vendor password and never a long-lived
-- stream URL.
--
-- This migration ONLY adds the enum value. PostgreSQL forbids *using* an enum
-- value added in the same transaction, and the next migration's CHECK
-- constraint references it — hence the split into two files (each migration
-- file runs in its own transaction).

alter type public.camera_type add value if not exists 'vendor_cloud';
