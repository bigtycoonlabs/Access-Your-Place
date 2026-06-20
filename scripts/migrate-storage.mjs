import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const storageRoot = process.argv[2];

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
if (!storageRoot) throw new Error('Usage: node scripts/migrate-storage.mjs C:\\Path\\To\\storage');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.zip': 'application/zip',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
  };
  return types[ext] || 'application/octet-stream';
}

async function walkFiles(dir) {
  const results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...await walkFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

async function ensureBucket(bucketName) {
  const isPublic = bucketName === 'property-photos';

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(`Could not list buckets: ${listError.message}`);

  const exists = buckets.some((bucket) => bucket.name === bucketName);
  if (exists) {
    console.log(`Bucket exists: ${bucketName}`);
    return;
  }

  const { error } = await supabase.storage.createBucket(bucketName, {
    public: isPublic
  });

  if (error) throw new Error(`Could not create bucket ${bucketName}: ${error.message}`);

  console.log(`Created bucket: ${bucketName} public=${isPublic}`);
}

async function uploadBucket(bucketPath, bucketName) {
  await ensureBucket(bucketName);

  const files = await walkFiles(bucketPath);

  console.log(`Uploading ${files.length} file(s) from ${bucketName}`);

  let uploaded = 0;
  let failed = 0;

  for (const filePath of files) {
    const relativePath = path.relative(bucketPath, filePath).split(path.sep).join('/');

    try {
      const buffer = await fs.readFile(filePath);

      const { error } = await supabase.storage
        .from(bucketName)
        .upload(relativePath, buffer, {
          contentType: contentTypeFor(filePath),
          upsert: true,
        });

      if (error) {
        failed++;
        console.error(`FAILED ${bucketName}/${relativePath}: ${error.message}`);
      } else {
        uploaded++;
        console.log(`Uploaded ${bucketName}/${relativePath}`);
      }
    } catch (err) {
      failed++;
      console.error(`FAILED ${bucketName}/${relativePath}: ${err.message}`);
    }
  }

  return { bucketName, uploaded, failed };
}

async function main() {
  const root = path.resolve(storageRoot);
  const entries = await fs.readdir(root, { withFileTypes: true });
  const bucketDirs = entries.filter((entry) => entry.isDirectory());

  console.log(`Storage root: ${root}`);
  console.log(`Found bucket folders: ${bucketDirs.map((entry) => entry.name).join(', ')}`);

  const summary = [];

  for (const bucketDir of bucketDirs) {
    const bucketName = bucketDir.name;
    const bucketPath = path.join(root, bucketName);
    summary.push(await uploadBucket(bucketPath, bucketName));
  }

  console.log('\nMigration summary:');

  for (const item of summary) {
    console.log(`${item.bucketName}: uploaded=${item.uploaded}, failed=${item.failed}`);
  }

  const totalFailed = summary.reduce((sum, item) => sum + item.failed, 0);

  if (totalFailed > 0) {
    process.exit(1);
  }

  console.log('\nStorage migration completed successfully.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
