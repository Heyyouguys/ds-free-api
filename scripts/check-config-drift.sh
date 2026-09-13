#!/usr/bin/env bash
# 校验 docker/config.example.toml 与根目录 config.example.toml 保持一致。
#
# 背景：两者唯一的**有意**差异是 `host`（容器内需要监听 0.0.0.0，本地默认 127.0.0.1）。
# 其余字段（含注释掉的默认值说明）必须同步，否则 Docker 用户看到的可配置项
# 会比文档少，属于典型的「文档漂移」。
#
# 用法：scripts/check-config-drift.sh
set -uo pipefail

readonly ROOT_CONFIG="config.example.toml"
readonly DOCKER_CONFIG="docker/config.example.toml"

if [ ! -f "$ROOT_CONFIG" ] || [ ! -f "$DOCKER_CONFIG" ]; then
    echo "✗ 缺少 $ROOT_CONFIG 或 $DOCKER_CONFIG"
    exit 1
fi

# 忽略注释与空行，只比较生效的配置键；再把唯一允许的差异归一化。
normalize() {
    grep -v '^[[:space:]]*#' "$1" \
        | grep -v '^[[:space:]]*$' \
        | sed 's/^host = .*/host = <HOST>/'
}

if ! diff <(normalize "$ROOT_CONFIG") <(normalize "$DOCKER_CONFIG") > /tmp/config-drift.diff 2>&1; then
    echo "✗ $DOCKER_CONFIG 与 $ROOT_CONFIG 的生效配置不一致（host 除外）："
    cat /tmp/config-drift.diff
    echo
    echo "请同步两份文件；容器与本地唯一允许的差异是 host。"
    exit 1
fi

echo "✓ 两份 config.example.toml 生效配置一致（仅 host 不同）"
