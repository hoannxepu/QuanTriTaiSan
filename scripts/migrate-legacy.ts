/**
 * Data Migration Script: Legacy JSON to Cloudflare D1
 * 
 * Usage:
 *   npx tsx scripts/migrate-legacy.ts [path/to/legacy.json] [output.sql]
 */

import fs from 'fs';
import path from 'path';
import { hashPassword } from '../functions/api/_auth';

async function runMigration() {
  const inputPath = process.argv[2] || path.resolve(process.cwd(), 'data', 'thap_tai_san_cloud.json');
  const outputPath = process.argv[3] || path.resolve(process.cwd(), 'migrations', '0002_seed_migrated_data.sql');

  if (!fs.existsSync(inputPath)) {
    console.error(`[Migrate] Input file not found: ${inputPath}`);
    console.log(`[Migrate] Creating template migration script.`);
    return;
  }

  const raw = fs.readFileSync(inputPath, 'utf-8');
  const legacy = JSON.parse(raw);

  const testUserPrefixes = ['qa_', 'race_', 'idempotent_', 'gold_user_', 'silent_user', 'test_user'];
  const isTestUser = (key: string) => testUserPrefixes.some(prefix => key.toLowerCase().startsWith(prefix));

  const canonicalOwnerKeys = [
    'phone_0966203310',
    '0966203310',
    'hoannx.epu@gmail.com',
    'mail_hoannx_epu_gmail_com',
    'user_hoannx_epu_gmail_com',
  ];

  // Find authoritative data for owner
  let ownerData: any = null;
  let ownerPasswordPlain = '123456';

  for (const k of canonicalOwnerKeys) {
    if (legacy.users?.[k]) {
      if (!ownerData || (legacy.users[k].version || 0) > (ownerData.version || 0)) {
        ownerData = legacy.users[k];
      }
    }
    if (legacy.passwords?.[k] && !legacy.passwords[k].includes('hash') && legacy.passwords[k].length < 32) {
      ownerPasswordPlain = legacy.passwords[k];
    }
  }

  if (!ownerData) {
    console.warn('[Migrate] No authoritative owner data found in legacy JSON; skipping.');
    return;
  }

  const sqlStatements: string[] = [];
  sqlStatements.push('-- Migrated Legacy Data into Cloudflare D1');

  // 1. Primary Owner: 1 canonical userId with 2 identifiers
  const canonicalUserId = 'usr_hoannx_epu';
  const { hash: passHash, salt: passSalt } = await hashPassword(ownerPasswordPlain);
  const now = new Date().toISOString();

  // Identifier 1: Phone
  sqlStatements.push(`INSERT OR REPLACE INTO users (id, identifier, pass_hash, pass_salt, user_id, created_at) VALUES ('usr_ident_phone_0966203310', '0966203310', '${passHash}', '${passSalt}', '${canonicalUserId}', '${now}');`);
  // Identifier 2: Email
  sqlStatements.push(`INSERT OR REPLACE INTO users (id, identifier, pass_hash, pass_salt, user_id, created_at) VALUES ('usr_ident_email_hoannx', 'hoannx.epu@gmail.com', '${passHash}', '${passSalt}', '${canonicalUserId}', '${now}');`);

  // Owner Data
  const escapedData = JSON.stringify(ownerData).replace(/'/g, "''");
  const version = typeof ownerData.version === 'number' && ownerData.version > 0 ? ownerData.version : 1;
  const updatedAt = ownerData.updated_at || now;

  sqlStatements.push(`INSERT OR REPLACE INTO user_data (user_id, version, updated_at, data) VALUES ('${canonicalUserId}', ${version}, '${updatedAt}', '${escapedData}');`);

  // 2. Migrate other non-test users if present
  if (legacy.users) {
    for (const [key, val] of Object.entries(legacy.users)) {
      if (canonicalOwnerKeys.includes(key) || isTestUser(key)) continue;

      let ident = key;
      if (ident.startsWith('phone_')) ident = ident.replace('phone_', '');
      if (ident.startsWith('mail_')) ident = ident.replace('mail_', '');
      if (ident.startsWith('user_')) ident = ident.replace('user_', '');

      const userPass = legacy.passwords?.[key] || 'ChangeMe2026!';
      const { hash: uHash, salt: uSalt } = await hashPassword(userPass);
      const uId = `usr_${ident.replace(/[^a-z0-9]/gi, '_')}`;

      const uEscaped = JSON.stringify(val).replace(/'/g, "''");
      const uVersion = (val as any)?.version || 1;
      const uUpdatedAt = (val as any)?.updated_at || now;

      sqlStatements.push(`INSERT OR REPLACE INTO users (id, identifier, pass_hash, pass_salt, user_id, created_at) VALUES ('${uId}_ident', '${ident.toLowerCase()}', '${uHash}', '${uSalt}', '${uId}', '${now}');`);
      sqlStatements.push(`INSERT OR REPLACE INTO user_data (user_id, version, updated_at, data) VALUES ('${uId}', ${uVersion}, '${uUpdatedAt}', '${uEscaped}');`);
    }
  }

  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outputPath, sqlStatements.join('\n') + '\n', 'utf-8');

  console.log(`[Migrate] Successfully generated migration script at: ${outputPath}`);
  console.log(`[Migrate] Total SQL Statements: ${sqlStatements.length - 1}`);
}

runMigration().catch(console.error);
