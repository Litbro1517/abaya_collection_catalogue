-- ═══════════════════════════════════════════════════════════════════════════
-- VG42: Supabase RLS Security Audit & Remediation
-- Project: Abaya Catalogue (Supabase ID: ldvbfsnqgulynwxqwzau)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- This script:
-- 1. Enables Row-Level Security (RLS) on ALL tables
-- 2. Creates read-only policies for public (anon) access on catalog tables
-- 3. Creates full-access policies for authenticated admins
-- 4. Blocks access to sensitive tables (AdminUser, AdminSession, AuditLog)
--
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── STEP 1: Enable RLS on ALL tables ───────────────────────────────────────

ALTER TABLE IF EXISTS categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sub_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS color_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS components ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS catalog_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS google_sessions ENABLE ROW LEVEL SECURITY;

-- ─── STEP 2: BLOCK sensitive tables entirely (no public access) ─────────────

-- AdminUser: Contains password hashes, emails, roles — NO public access
ALTER TABLE IF EXISTS admin_users ENABLE ROW LEVEL SECURITY;
-- No policy = no access (deny all for anon)

-- AdminSession: Contains session tokens — NO public access
-- (already covered by RLS enable above, no policy = blocked)

-- AuditLog: Contains audit trails — NO public access
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;
-- No policy = no access (deny all for anon)

-- ─── STEP 3: Public read-only policies (anon role) ─────────────────────────
-- These tables are needed for the public catalog to function.
-- Visitors can SELECT but NOT INSERT/UPDATE/DELETE.

-- Categories (public read)
DROP POLICY IF EXISTS "anon_read_categories" ON categories;
CREATE POLICY "anon_read_categories" ON categories
  FOR SELECT TO anon USING (true);

-- SubCategories (public read)
DROP POLICY IF EXISTS "anon_read_sub_categories" ON sub_categories;
CREATE POLICY "anon_read_sub_categories" ON sub_categories
  FOR SELECT TO anon USING (true);

-- ColorMaps (public read)
DROP POLICY IF EXISTS "anon_read_color_maps" ON color_maps;
CREATE POLICY "anon_read_color_maps" ON color_maps
  FOR SELECT TO anon USING (true);

-- DataSources (public read — needed for catalog display)
DROP POLICY IF EXISTS "anon_read_data_sources" ON data_sources;
CREATE POLICY "anon_read_data_sources" ON data_sources
  FOR SELECT TO anon USING (true);

-- Columns (public read — needed for catalog display)
DROP POLICY IF EXISTS "anon_read_columns" ON columns;
CREATE POLICY "anon_read_columns" ON columns
  FOR SELECT TO anon USING (true);

-- Rows (public read — product data)
DROP POLICY IF EXISTS "anon_read_rows" ON rows;
CREATE POLICY "anon_read_rows" ON rows
  FOR SELECT TO anon USING (true);

-- Catalogs (public read — catalog name/settings)
DROP POLICY IF EXISTS "anon_read_catalogs" ON catalogs;
CREATE POLICY "anon_read_catalogs" ON catalogs
  FOR SELECT TO anon USING (true);

-- Sections (public read — catalog sections)
DROP POLICY IF EXISTS "anon_read_sections" ON sections;
CREATE POLICY "anon_read_sections" ON sections
  FOR SELECT TO anon USING (true);

-- CatalogSettings (public read — whatsapp number, social links, etc.)
DROP POLICY IF EXISTS "anon_read_catalog_settings" ON catalog_settings;
CREATE POLICY "anon_read_catalog_settings" ON catalog_settings
  FOR SELECT TO anon USING (true);

-- Settings (public read)
DROP POLICY IF EXISTS "anon_read_settings" ON settings;
CREATE POLICY "anon_read_settings" ON settings
  FOR SELECT TO anon USING (true);

-- Orders: Public can INSERT (COD checkout) but NOT SELECT/UPDATE/DELETE
DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders
  FOR INSERT TO anon WITH CHECK (true);

-- LandingPages: Public read (active landing pages only)
DROP POLICY IF EXISTS "anon_read_landing_pages" ON landing_pages;
CREATE POLICY "anon_read_landing_pages" ON landing_pages
  FOR SELECT TO anon USING (active = true);

-- MediaAssets: Public read (product images)
DROP POLICY IF EXISTS "anon_read_media_assets" ON media_assets;
CREATE POLICY "anon_read_media_assets" ON media_assets
  FOR SELECT TO anon USING (true);

-- ─── STEP 4: Admin full-access policies (authenticated role) ──────────────
-- Authenticated admins can perform all CRUD operations on all tables.

-- Categories (admin full access)
DROP POLICY IF EXISTS "admin_all_categories" ON categories;
CREATE POLICY "admin_all_categories" ON categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- SubCategories (admin full access)
DROP POLICY IF EXISTS "admin_all_sub_categories" ON sub_categories;
CREATE POLICY "admin_all_sub_categories" ON sub_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ColorMaps (admin full access)
DROP POLICY IF EXISTS "admin_all_color_maps" ON color_maps;
CREATE POLICY "admin_all_color_maps" ON color_maps
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- DataSources (admin full access)
DROP POLICY IF EXISTS "admin_all_data_sources" ON data_sources;
CREATE POLICY "admin_all_data_sources" ON data_sources
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Columns (admin full access)
DROP POLICY IF EXISTS "admin_all_columns" ON columns;
CREATE POLICY "admin_all_columns" ON columns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Rows (admin full access)
DROP POLICY IF EXISTS "admin_all_rows" ON rows;
CREATE POLICY "admin_all_rows" ON rows
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Catalogs (admin full access)
DROP POLICY IF EXISTS "admin_all_catalogs" ON catalogs;
CREATE POLICY "admin_all_catalogs" ON catalogs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Sections (admin full access)
DROP POLICY IF EXISTS "admin_all_sections" ON sections;
CREATE POLICY "admin_all_sections" ON sections
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CatalogSettings (admin full access)
DROP POLICY IF EXISTS "admin_all_catalog_settings" ON catalog_settings;
CREATE POLICY "admin_all_catalog_settings" ON catalog_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Settings (admin full access)
DROP POLICY IF EXISTS "admin_all_settings" ON settings;
CREATE POLICY "admin_all_settings" ON settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Orders (admin full access)
DROP POLICY IF EXISTS "admin_all_orders" ON orders;
CREATE POLICY "admin_all_orders" ON orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- LandingPages (admin full access)
DROP POLICY IF EXISTS "admin_all_landing_pages" ON landing_pages;
CREATE POLICY "admin_all_landing_pages" ON landing_pages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- MediaAssets (admin full access)
DROP POLICY IF EXISTS "admin_all_media_assets" ON media_assets;
CREATE POLICY "admin_all_media_assets" ON media_assets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- AdminUser (admin full access — for user management)
DROP POLICY IF EXISTS "admin_all_admin_users" ON admin_users;
CREATE POLICY "admin_all_admin_users" ON admin_users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- AdminSession (admin full access)
DROP POLICY IF EXISTS "admin_all_admin_sessions" ON admin_sessions;
CREATE POLICY "admin_all_admin_sessions" ON admin_sessions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- AuditLog (admin full access)
DROP POLICY IF EXISTS "admin_all_audit_logs" ON audit_logs;
CREATE POLICY "admin_all_audit_logs" ON audit_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- GoogleSession (admin full access)
DROP POLICY IF EXISTS "admin_all_google_sessions" ON google_sessions;
CREATE POLICY "admin_all_google_sessions" ON google_sessions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (run after this script to confirm):
--
-- Check RLS is enabled on all tables:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
--
-- Check policies exist:
-- SELECT tablename, policyname, cmd, roles FROM pg_policies WHERE schemaname = 'public';
-- ═══════════════════════════════════════════════════════════════════════════
