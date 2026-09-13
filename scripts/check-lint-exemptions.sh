#!/usr/bin/env bash
# 强制执行 AGENTS.md 的 lint 豁免约定：
#
#   Do NOT use `#[allow(...)]` in any file except ds_core/src/accounts/client.rs
#
# `#[allow]` 会静默掩盖真实的死代码 / 未使用值，是最容易被「顺手」加上的抑制手段。
# 本项目只允许在原始 HTTP 客户端层使用它（该层需要为 API 对称性保留未被消费的字段），
# 其他文件新增豁免必须改为重构或显式消费该值。
#
# 例外：`#[allow(clippy::...)]` 出现在 `#[cfg(test)]` 模块内时同样禁止。
#
# 用法：scripts/check-lint-exemptions.sh
set -uo pipefail

readonly ALLOWED_FILE="ds_core/src/accounts/client.rs"

violations="$(
    grep -rn --include='*.rs' '#\[allow(' src ds_core/src examples 2>/dev/null \
        | grep -v "^${ALLOWED_FILE}:" \
        | grep -v '^ds_core/src/accounts/client.rs:' \
        || true
)"

if [ -n "$violations" ]; then
    echo "✗ 发现不允许的 lint 豁免（只允许出现在 ${ALLOWED_FILE}）："
    printf '%s\n' "$violations"
    echo
    echo "请改为重构或显式消费该值，而不是添加 #[allow]。"
    echo "若确有正当理由，请先更新 AGENTS.md 的 Anti-Patterns 一节。"
    exit 1
fi

# ── 中文日志检查（docs/logging-spec.md「Prohibited Practices」）─────────
# 所有日志必须是英文；中文日志在 RUST_LOG 过滤与日志聚合系统里都难以检索。
cn_logs="$(
    grep -rnP --include='*.rs' '(info|warn|error|debug|trace)!\\([^)]*[\x{4e00}-\x{9fff}]' src ds_core/src 2>/dev/null || true
)"

if [ -n "$cn_logs" ]; then
    echo "✗ 发现中文日志消息（docs/logging-spec.md 要求全部为英文）："
    printf '%s\n' "$cn_logs"
    exit 1
fi

echo "✓ lint 豁免检查通过（仅 ${ALLOWED_FILE} 允许 #[allow]）"
echo "✓ 日志语言检查通过（无中文日志消息）"
