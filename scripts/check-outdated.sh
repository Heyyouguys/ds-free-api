#!/usr/bin/env bash
# cargo-outdated 包装脚本
#
# 背景：wreq 5.x 已被上游全部 yank（crates.io 上非 yanked 的只有 6.0.0-rc.*），
# 而 cargo-outdated 会为工作区重新解析依赖树，遇到 yanked 版本直接报错退出：
#
#   error: failed to select a version for the requirement `wreq = "^5.3.0"`
#     version 5.3.0 is yanked
#
# 这是当前唯一无法通过升级消除的阻塞点（升级到 6.0 pre-release 属于破坏性迁移，
# 详见 .cargo/audit.toml 说明）。因此这里把「因 yanked 导致的解析失败」识别为已知跳过，
# 其他失败（真的有新版可用、或命令本身出错）仍然照常以非零码退出。
#
# 用法：scripts/check-outdated.sh [cargo outdated 的额外参数...]
set -uo pipefail

out="$(cargo outdated --exit-code 1 --root-deps-only "$@" 2>&1)"
status=$?
printf '%s\n' "$out"

if [ "$status" -ne 0 ] && grep -q 'is yanked' <<<"$out"; then
    echo "[skip] cargo outdated: 依赖树中存在被 yank 的 wreq 5.x，cargo 无法解析（见 .cargo/audit.toml）"
    exit 0
fi
exit "$status"
