//! DeepSeek 核心配置 —— 独立于根 crate 的 Config
//!
//! 由根 crate 的 `Config` 构造转换而来。

/// ds_core 所需的配置（从根 crate Config 的子集构造）
#[derive(Debug, Clone)]
pub struct DsCoreConfig {
    pub api_base: String,
    pub wasm_url: String,
    pub user_agent: String,
    pub client_version: String,
    pub client_platform: String,
    pub client_locale: String,
    pub proxy_url: Option<String>,
    pub model_types: Vec<String>,
    pub input_character_limits: Vec<u32>,
    /// 每账号每小时请求上限（0 = 不限制）
    pub hourly_request_quota: u64,
}

/// 单个账号配置
#[derive(Debug, Clone)]
pub struct AccountConfig {
    pub email: String,
    pub mobile: String,
    pub area_code: String,
    pub password: String,
    /// 浏览器设备指纹 ID。
    ///
    /// **实测为必填**：缺失会被登录风控直接拒绝（`RISK_DEVICE_DETECTED`，biz_code 11）。
    ///
    /// 建议**每个账号使用独立的 device_id**：设备级指纹被上游用于关联与画像，
    /// 同一指纹下挂多个账号、累计数百次请求后，账号会被禁言（`biz_code=5`）。
    pub device_id: String,
}
