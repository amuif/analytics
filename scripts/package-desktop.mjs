import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('----------------------------------------------------');
console.log(' [Decide Automation] Desktop Packaging Pipeline');
console.log('----------------------------------------------------\n');

try {
  // 1. Build Web Assets
  console.log('[1/4] Compiling web production bundle (vite build)...');
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

  // 2. Compile Tauri Native Binary
  console.log('\n[2/4] Compiling native Windows desktop executable (npx tauri build --no-bundle)...');
  execSync('npx tauri build --no-bundle', { cwd: rootDir, stdio: 'inherit' });

  // 3. Locate compiled binary
  const possiblePaths = [
    path.join(rootDir, 'src-tauri', 'target', 'release', 'Decide.exe'),
    path.join(rootDir, 'src-tauri', 'target', 'release', 'app.exe'),
    path.join(rootDir, 'src-tauri', 'target', 'release', 'decide.exe')
  ];

  let srcExe = possiblePaths.find(p => fs.existsSync(p));
  if (!srcExe) {
    throw new Error('Could not find compiled desktop executable in src-tauri/target/release/');
  }

  const stat = fs.statSync(srcExe);
  const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);
  console.log(`\n[3/4] Located compiled binary: ${srcExe} (${sizeMB} MB)`);

  // 4. Ensure destination folders
  const publicDownloads = path.join(rootDir, 'public', 'downloads');
  const distDownloads = path.join(rootDir, 'dist', 'downloads');
  fs.mkdirSync(publicDownloads, { recursive: true });
  fs.mkdirSync(distDownloads, { recursive: true });

  const destPublicExe = path.join(publicDownloads, 'Decide.exe');
  const destDistExe = path.join(distDownloads, 'Decide.exe');

  fs.copyFileSync(srcExe, destPublicExe);
  fs.copyFileSync(srcExe, destDistExe);
  console.log(`Copied binary to:`);
  console.log(`  -> ${destPublicExe}`);
  console.log(`  -> ${destDistExe}`);

  // 5. Generate metadata
  const metadata = {
    name: 'Decide',
    filename: 'Decide.exe',
    version: '1.0.0',
    platform: 'windows-x64',
    sizeBytes: stat.size,
    sizeMB: `${sizeMB} MB`,
    builtAt: new Date().toISOString(),
    downloadUrl: '/downloads/Decide.exe'
  };

  const metaJson = JSON.stringify(metadata, null, 2);
  fs.writeFileSync(path.join(publicDownloads, 'metadata.json'), metaJson, 'utf-8');
  fs.writeFileSync(path.join(distDownloads, 'metadata.json'), metaJson, 'utf-8');

  console.log('\n[4/4] Metadata written to downloads/metadata.json:');
  console.log(metaJson);

  console.log('\n====================================================');
  console.log(' [Decide Automation] Desktop package build completed!');
  console.log(` Binary Ready: /downloads/Decide.exe (${sizeMB} MB)`);
  console.log('====================================================\n');
} catch (err) {
  console.error('\n[Decide Automation ERROR]:', err.message);
  process.exit(1);
}
