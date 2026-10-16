import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extensionDirectory = path.join(root, 'extension');

async function read(relativePath) {
  return readFile(path.join(extensionDirectory, relativePath), 'utf8');
}

test('manifest uses the minimum site and storage access', async () => {
  const manifest = JSON.parse(await read('manifest.json'));

  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.optional_permissions, undefined);
  assert.deepEqual(manifest.background, {
    service_worker: 'background.js',
  });
  assert.deepEqual(manifest.action, {
    default_title: '显示英语录制节奏助手',
    default_icon: manifest.icons,
  });
  assert.deepEqual(manifest.content_scripts, [{
    matches: [
      'https://bytedance.aiforce.cloud/app/*',
      'https://bytedance.feishuapp.com/app/*',
    ],
    js: ['core.js', 'dom.js', 'overlay.css.js', 'overlay.js', 'content.js'],
    run_at: 'document_idle',
  }]);
});

test('every declared extension resource is bundled locally', async () => {
  const manifest = JSON.parse(await read('manifest.json'));
  const resources = [
    manifest.background.service_worker,
    ...manifest.content_scripts.flatMap((entry) => entry.js),
    ...Object.values(manifest.icons),
  ];

  for (const resource of resources) {
    const contents = await readFile(path.join(extensionDirectory, resource));
    assert.ok(contents.length > 0, `${resource} should not be empty`);
  }
});

test('runtime code has no recording, remote-code, or early-silence path', async () => {
  const runtime = (
    await Promise.all(['background.js', 'core.js', 'dom.js', 'overlay.js', 'content.js'].map(read))
  ).join('\n');

  for (const forbidden of [
    /getUserMedia/,
    /mediaDevices/,
    /XMLHttpRequest/,
    /WebSocket/,
    /\bfetch\s*\(/,
    /提前静音/,
    /均匀放慢/,
    /脚本需复核/,
  ]) {
    assert.doesNotMatch(runtime, forbidden);
  }
});
