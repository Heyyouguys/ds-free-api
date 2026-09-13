#!/usr/bin/env node
/**
 * 校验 web/src/locales/{zh,en,id}/common.json 的键集合完全一致。
 *
 * AGENTS.md 要求三个语言文件保持相同键集；缺键会让 i18n 回退到 key 字面量，
 * 这类问题在运行时很难发现，因此在 CI 中显式失败。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const localesDir = join(root, 'src', 'locales');

/** 递归收集 "a.b.c" 形式的叶子键 */
function flatten(obj, prefix = '', out = new Set()) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out.add(path);
    }
  }
  return out;
}

const locales = readdirSync(localesDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

if (locales.length === 0) {
  console.error('✗ 未找到任何语言目录');
  process.exit(1);
}

const keySets = new Map();
for (const locale of locales) {
  const file = join(localesDir, locale, 'common.json');
  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  keySets.set(locale, flatten(parsed));
}

const reference = locales.includes('en') ? 'en' : locales[0];
const referenceKeys = keySets.get(reference);

let failed = false;
for (const [locale, keys] of keySets) {
  if (locale === reference) continue;
  const missing = [...referenceKeys].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !referenceKeys.has(k));
  if (missing.length > 0 || extra.length > 0) {
    failed = true;
    console.error(`✗ ${locale}: 与 ${reference} 键集不一致`);
    if (missing.length > 0) console.error(`  缺失 (${missing.length}): ${missing.join(', ')}`);
    if (extra.length > 0) console.error(`  多余 (${extra.length}): ${extra.join(', ')}`);
  }
}

if (failed) {
  console.error('\ni18n 键集必须完全一致（见 AGENTS.md）');
  process.exit(1);
}

console.log(`✓ i18n 键集一致（${locales.length} 种语言，各 ${referenceKeys.size} 个键）`);
