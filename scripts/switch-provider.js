#!/usr/bin/env node
/**
 * Prisma Provider Switcher
 * ━━━━━━━━━━━━━━━━━━━━━━━━
 * Automatically switches Prisma datasource provider based on DATABASE_URL:
 *   - postgresql:// or postgres:// → provider = "postgresql" (Vercel production)
 *   - file: or empty               → provider = "sqlite"     (local development)
 *
 * This runs as part of the build script before `prisma generate`,
 * ensuring the correct client is generated for each environment.
 */
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');

if (!fs.existsSync(schemaPath)) {
  console.error('❌ prisma/schema.prisma not found');
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL || '';
let schema = fs.readFileSync(schemaPath, 'utf8');

if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
  // Switch to PostgreSQL for production (Vercel)
  if (schema.includes('provider = "postgresql"')) {
    console.log('✅ Prisma provider already set to PostgreSQL — no change needed');
  } else {
    schema = schema.replace('provider = "sqlite"', 'provider = "postgresql"');
    // Add directUrl for connection pooling if not present
    if (!schema.includes('directUrl')) {
      schema = schema.replace(
        'url      = env("DATABASE_URL")',
        'url      = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")'
      );
    }
    fs.writeFileSync(schemaPath, schema);
    console.log('✅ Switched Prisma provider to PostgreSQL (production)');
  }
} else {
  // Keep SQLite for local development
  if (schema.includes('provider = "sqlite"')) {
    console.log('✅ Prisma provider already set to SQLite — no change needed');
  } else {
    schema = schema.replace('provider = "postgresql"', 'provider = "sqlite"');
    // Remove directUrl line if present (SQLite doesn't use it)
    schema = schema.replace(/\n\s*directUrl\s*=\s*env\("DIRECT_URL"\)/, '');
    fs.writeFileSync(schemaPath, schema);
    console.log('✅ Switched Prisma provider to SQLite (local development)');
  }
}
