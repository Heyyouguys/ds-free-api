//! 构建脚本 —— 校验前端产物是否就绪
//!
//! `src/server.rs` 用 `rust_embed` 的 `#[folder = "web/dist/"]` 把管理面板编译进二进制。
//! 这个宏在目录缺失或为空时**不会报错**，只会生成一个空的嵌入资源
//! （`WebAssets::get` 干脆不存在），于是 `cargo build --release` 能成功、
//! 但发布出来的二进制完全没有管理面板 —— 这是一个只在运行时才暴露的静默失败。
//!
//! 这里在编译期把该情况变成显式告警，并对 release profile 直接失败（fail fast）。
//! debug 构建仍然放行，方便尚未构建前端时执行 `cargo check` / `cargo test`。
//!
//! 触发重新运行的条件：`web/dist` 目录本身，以及其中的 `index.html`。

use std::path::Path;

fn main() {
    println!("cargo:rerun-if-changed=web/dist");
    println!("cargo:rerun-if-changed=web/dist/index.html");

    let index = Path::new("web/dist/index.html");
    if index.is_file() {
        return;
    }

    // `PROFILE` 由 Cargo 注入（debug / release）；自定义 profile 可能是
    // "release-*"，因此按前缀判断。
    let profile = std::env::var("PROFILE").unwrap_or_default();
    let message = "\
web/dist/index.html 缺失：rust_embed 会静默嵌入空资源，编译产物将不含管理面板。\
请先执行 `cd web && bun run build`（或 `just serve`，它会先构建前端）。";

    if profile.starts_with("release") {
        panic!("{message}");
    }

    println!("cargo:warning={message}");
}
