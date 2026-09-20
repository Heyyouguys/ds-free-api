//! DeepSeek HTTP 客户端 —— 原始 API 调用层
//!
//! 无状态管理：无缓存、无重试、无会话状态。
//! 每个方法对应一个 REST 端点（详见 docs/ds-api-reference.md）。
//! 流方法（completion/edit_message）返回原始字节流，由上层解析 SSE。
//!
//! 仅包含最小业务逻辑：HTTP 错误码和业务错误码解析（into_result）。

use bytes::Bytes;
use futures::{Stream, TryStreamExt};
use log::warn;
use serde::{Deserialize, Serialize};
use std::pin::Pin;
use thiserror::Error;
use wreq::multipart::{Form, Part};
use wreq_util::Emulation;

// API 端点常量
const ENDPOINT_USERS_LOGIN: &str = "/users/login";
#[allow(dead_code)]
const ENDPOINT_USERS_CURRENT: &str = "/users/current";
const ENDPOINT_USERS_AUTH_TOKEN_CHECK_DEVICE: &str = "/users/auth_token/check_device";
const ENDPOINT_CHAT_SESSION_CREATE: &str = "/chat_session/create";
const ENDPOINT_CHAT_SESSION_DELETE: &str = "/chat_session/delete";
const ENDPOINT_CHAT_SESSION_FETCH_PAGE: &str = "/chat_session/fetch_page";
#[allow(dead_code)]
const ENDPOINT_CHAT_SESSION_UPDATE_TITLE: &str = "/chat_session/update_title";
const ENDPOINT_CHAT_CREATE_POW_CHALLENGE: &str = "/chat/create_pow_challenge";
const ENDPOINT_CHAT_COMPLETION: &str = "/chat/completion";
#[allow(dead_code)]
const ENDPOINT_CHAT_EDIT_MESSAGE: &str = "/chat/edit_message";
const ENDPOINT_CHAT_STOP_STREAM: &str = "/chat/stop_stream";
const ENDPOINT_FILE_UPLOAD: &str = "/file/upload_file";
const ENDPOINT_FILE_FETCH: &str = "/file/fetch_files";

#[derive(Debug, Error)]
pub enum ClientError {
    /// HTTP 层错误（网络、超时、DNS 等）
    #[error("HTTP error: {0}")]
    Http(#[from] wreq::Error),

    /// HTTP 状态码非 2xx
    #[error("HTTP status {status}: {body}")]
    Status { status: u16, body: String },

    /// 业务错误：API 返回 HTTP 200 但 biz_code 非 0
    #[error("Business error: code={code}, msg={msg}")]
    Business { code: i64, msg: String },

    /// JSON 解析失败
    #[error("JSON parse error: {0}")]
    Json(#[from] serde_json::Error),

    /// Header 值包含非法字符
    #[error("Invalid header value: {0}")]
    InvalidHeader(String),
}

#[derive(Debug, Deserialize)]
struct Envelope<T> {
    code: i64,
    msg: String,
    data: Option<EnvelopeData<T>>,
}

#[derive(Debug, Deserialize)]
struct EnvelopeData<T> {
    biz_code: i64,
    biz_msg: String,
    biz_data: Option<T>,
}

impl<T: serde::de::DeserializeOwned> Envelope<T> {
    fn into_result(self) -> Result<T, ClientError> {
        if self.code != 0 {
            return Err(ClientError::Business {
                code: self.code,
                msg: self.msg,
            });
        }
        let data = self.data.ok_or_else(|| ClientError::Business {
            code: -1,
            msg: "missing data".into(),
        })?;
        if data.biz_code != 0 {
            return Err(ClientError::Business {
                code: data.biz_code,
                msg: data.biz_msg,
            });
        }
        data.biz_data.map_or_else(
            || {
                // 允许 biz_data 为 null，尝试从 null 构造 T（仅当 T 是 Option 时成功）
                serde_json::from_value(serde_json::Value::Null).map_err(|_| ClientError::Business {
                    code: -1,
                    msg: "missing biz_data".into(),
                })
            },
            Ok,
        )
    }
}

#[derive(Debug, Serialize)]
pub struct LoginPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mobile: Option<String>,
    pub password: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub area_code: Option<String>,
    pub device_id: String,
    pub os: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginData {
    pub code: i64,
    pub msg: String,
    pub user: UserInfo,
}

/// 账号禁言状态（登录响应与 /users/current 均返回）
#[derive(Debug, Clone, Deserialize)]
pub struct ChatStatus {
    /// 1 = 被禁言；接受 int / bool 两种形态
    #[serde(default, deserialize_with = "de_muted_flag")]
    pub is_muted: i64,
    /// 解封时间戳（Unix 秒，浮点）；None = 未设置
    #[serde(default)]
    pub mute_until: Option<f64>,
}

/// 兼容 int(0/1) 与 bool 两种 is_muted 形态
fn de_muted_flag<'de, D>(d: D) -> Result<i64, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let v = serde_json::Value::deserialize(d)?;
    Ok(match v {
        serde_json::Value::Bool(b) => i64::from(b),
        serde_json::Value::Number(n) => n.as_i64().unwrap_or(0),
        _ => 0,
    })
}

#[derive(Debug, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub token: String,
    pub email: Option<String>,
    pub mobile_number: Option<String>,
    /// 禁言状态（缺失视为未禁言）
    #[serde(default)]
    pub chat: Option<ChatStatus>,
}

/// POST /users/auth_token/check_device 响应
#[derive(Debug, Deserialize)]
pub struct CheckDeviceData {
    /// 服务端下发的令牌轮换指令（通常为 null）
    pub rotate: Option<serde_json::Value>,
}

/// GET /chat_session/fetch_page 响应中的单个会话
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ChatSessionInfo {
    pub id: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub title_type: Option<String>,
    #[serde(default)]
    pub pinned: bool,
    #[serde(default)]
    pub model_type: Option<String>,
    /// 更新时间戳（Unix 秒，浮点）—— 分页游标
    #[serde(default)]
    pub updated_at: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct FetchSessionsData {
    #[serde(default)]
    pub chat_sessions: Vec<ChatSessionInfo>,
    #[serde(default)]
    pub has_more: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct CreateSessionData {
    pub id: String,
}

// 包装类型：biz_data 里面嵌套了 chat_session 对象
#[derive(Debug, Deserialize)]
struct CreateSessionWrapper {
    chat_session: CreateSessionData,
}

#[derive(Debug, Deserialize)]
pub struct UploadFileData {
    pub id: String,
    #[allow(dead_code)]
    pub status: String,
    #[allow(dead_code)]
    pub file_name: String,
    #[allow(dead_code)]
    pub file_size: i64,
}

#[derive(Debug, Deserialize)]
pub struct FetchFilesData {
    pub files: Vec<FileInfo>,
}

#[derive(Debug, Deserialize)]
pub struct FileInfo {
    #[allow(dead_code)]
    pub id: String,
    pub status: String,
    pub file_name: String,
    #[allow(dead_code)]
    pub file_size: i64,
    #[serde(default)]
    pub token_usage: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct ChallengeData {
    pub algorithm: String,
    pub challenge: String,
    pub salt: String,
    pub signature: String,
    pub difficulty: i64,
    #[allow(dead_code)]
    pub expire_after: i64,
    pub expire_at: i64,
    pub target_path: String,
}

// 包装类型：biz_data 里面嵌套了 challenge 对象
#[derive(Debug, Deserialize)]
struct ChallengeWrapper {
    challenge: ChallengeData,
}

#[derive(Debug, Serialize)]
pub struct CompletionPayload {
    pub chat_session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_message_id: Option<i64>,
    pub model_type: String,
    pub prompt: String,
    pub ref_file_ids: Vec<String>,
    pub thinking_enabled: bool,
    pub search_enabled: bool,
    pub preempt: bool,
}

#[derive(Debug, Serialize)]
#[allow(dead_code)]
pub struct EditMessagePayload {
    pub chat_session_id: String,
    pub message_id: i64,
    pub prompt: String,
    pub search_enabled: bool,
    pub thinking_enabled: bool,
    pub model_type: String,
}

#[derive(Debug, Serialize)]
#[allow(dead_code)]
pub struct UpdateTitlePayload {
    pub chat_session_id: String,
    pub title: String,
}

#[derive(Debug, Serialize)]
pub struct StopStreamPayload {
    pub chat_session_id: String,
    pub message_id: i64,
}

/// Check if a response is an AWS WAF Challenge (US IP restriction)
fn is_waf_challenge(resp: &wreq::Response) -> bool {
    resp.status().as_u16() == 202 && resp.headers().get("x-amzn-waf-action").is_some()
}

/// Print a hint when WAF challenge is detected
fn print_waf_hint() {
    warn!(target: "ds_core::client", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    warn!(target: "ds_core::client", "  AWS WAF Challenge detected.");
    warn!(target: "ds_core::client", "  DeepSeek CloudFront WAF blocks US-based IPs.");
    warn!(target: "ds_core::client", "  Rust HTTP clients can't execute the JS challenge.");
    warn!(target: "ds_core::client", "");
    warn!(target: "ds_core::client", "  To fix this, configure a non-US proxy in config.toml:");
    warn!(target: "ds_core::client", "    [proxy]");
    warn!(target: "ds_core::client", "    url = \"http://127.0.0.1:7890\"");
    warn!(target: "ds_core::client", "");
    warn!(target: "ds_core::client", "  https://github.com/niyue/ds-free-api");
    warn!(target: "ds_core::client", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

#[derive(Clone)]
pub struct DsClient {
    http: wreq::Client,
    api_base: String,
    wasm_url: String,
    user_agent: String,
    client_version: String,
    client_platform: String,
    client_locale: String,
    client_bundle_id: String,
    /// 设备级 UUID（X-Device-Id 头 / check_device payload）
    device_id: String,
    device_model: String,
    timezone_offset: String,
    /// 登录 payload 的 os 字段值
    client_os: String,
}

impl DsClient {
    #[must_use]
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        api_base: String,
        wasm_url: String,
        user_agent: String,
        client_version: String,
        client_platform: String,
        client_locale: String,
        client_bundle_id: String,
        client_device_id: String,
        client_device_model: String,
        client_timezone_offset: String,
        client_os: String,
        proxy_url: Option<&str>,
    ) -> Self {
        let mut builder = wreq::Client::builder().emulation(Emulation::Chrome136);
        if let Some(url) = proxy_url.and_then(|u| wreq::Proxy::all(u).ok()) {
            builder = builder.proxy(url);
        }
        // 空 = 按 api_base 确定性派生，保证重启后设备身份不变
        let device_id = if client_device_id.trim().is_empty() {
            derive_device_uuid(api_base.as_bytes())
        } else {
            client_device_id.trim().to_string()
        };
        Self {
            http: builder.build().expect("构建 HTTP 客户端失败"),
            api_base,
            wasm_url,
            user_agent,
            client_version,
            client_platform,
            client_locale,
            client_bundle_id,
            device_id,
            device_model: client_device_model,
            timezone_offset: client_timezone_offset,
            client_os,
        }
    }

    /// 登录 payload 使用的 os 值
    pub(crate) fn client_os(&self) -> &str {
        &self.client_os
    }

    /// 客户端通用请求头（登录与鉴权请求共用）
    ///
    /// 对齐真实客户端（2026-09 抓包）：除 UA 外还带 7 个 x-* 头，
    /// 缺这些头会明显拉低「像真实客户端」的拟态保真度。
    fn client_headers(&self) -> Result<wreq::header::HeaderMap, ClientError> {
        let mut h = wreq::header::HeaderMap::new();
        let mut put = |name: &'static str, value: &str| -> Result<(), ClientError> {
            h.insert(
                name,
                wreq::header::HeaderValue::from_str(value)
                    .map_err(|e| ClientError::InvalidHeader(format!("{name}: {e}")))?,
            );
            Ok(())
        };
        put(wreq::header::USER_AGENT.as_str(), &self.user_agent)?;
        put("X-Client-Version", &self.client_version)?;
        put("X-Client-Platform", &self.client_platform)?;
        put("X-Client-Locale", &self.client_locale)?;
        put("X-Client-Bundle-Id", &self.client_bundle_id)?;
        put("X-Device-Id", &self.device_id)?;
        put("X-Device-Model", &self.device_model)?;
        put("X-Client-Timezone-Offset", &self.timezone_offset)?;
        Ok(h)
    }

    fn auth_headers(&self, token: &str) -> Result<wreq::header::HeaderMap, ClientError> {
        let mut h = self.client_headers()?;
        h.insert(
            wreq::header::AUTHORIZATION,
            wreq::header::HeaderValue::from_str(&format!("Bearer {token}"))
                .map_err(|e| ClientError::InvalidHeader(format!("Authorization: {e}")))?,
        );
        Ok(h)
    }

    fn auth_headers_with_pow(
        &self,
        token: &str,
        pow_response: &str,
    ) -> Result<wreq::header::HeaderMap, ClientError> {
        let mut h = self.auth_headers(token)?;
        h.insert(
            "X-Ds-Pow-Response",
            wreq::header::HeaderValue::from_str(pow_response)
                .map_err(|e| ClientError::InvalidHeader(format!("X-Ds-Pow-Response: {e}")))?,
        );
        Ok(h)
    }

    async fn parse_envelope<T: serde::de::DeserializeOwned>(
        resp: wreq::Response,
    ) -> Result<T, ClientError> {
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(ClientError::Status {
                status: status.as_u16(),
                body,
            });
        }
        let envelope: Envelope<T> = resp.json().await?;
        envelope.into_result()
    }

    pub async fn login(&self, payload: &LoginPayload) -> Result<LoginData, ClientError> {
        let mut h = self.client_headers()?;
        h.insert(
            wreq::header::REFERER,
            wreq::header::HeaderValue::from_static("https://chat.deepseek.com/sign_in"),
        );
        let resp = self
            .http
            .post(format!("{}{}", self.api_base, ENDPOINT_USERS_LOGIN))
            .headers(h)
            .json(payload)
            .send()
            .await?;

        if is_waf_challenge(&resp) {
            print_waf_hint();
            return Err(ClientError::Status {
                status: 202,
                body: "WAF Challenge: use a non-US proxy".into(),
            });
        }

        Self::parse_envelope::<LoginData>(resp).await
    }

    /// 当前登录用户信息（含禁言状态）
    ///
    /// 与登录响应的 user 字段同构；探测禁言优先用登录响应（零额外请求），
    /// 此方法保留作原始客户端 API 对称面（同 `update_title` / `edit_message`）。
    #[allow(dead_code)]
    pub async fn current_user(&self, token: &str) -> Result<UserInfo, ClientError> {
        let resp = self
            .http
            .get(format!("{}{}", self.api_base, ENDPOINT_USERS_CURRENT))
            .headers(self.auth_headers(token)?)
            .send()
            .await?;
        Self::parse_envelope::<UserInfo>(resp).await
    }

    /// 设备校验 / 令牌轮换检查
    ///
    /// 真实客户端登录成功后立即调用；`rotate` 非 null 时服务端要求轮换令牌
    /// （可能是字符串或含 token 字段的对象，由调用方解析）。
    pub async fn check_device(&self, token: &str) -> Result<CheckDeviceData, ClientError> {
        let resp = self
            .http
            .post(format!(
                "{}{}",
                self.api_base, ENDPOINT_USERS_AUTH_TOKEN_CHECK_DEVICE
            ))
            .headers(self.auth_headers(token)?)
            .json(&serde_json::json!({
                "device_id": self.device_id,
                "device_model": self.device_model,
            }))
            .send()
            .await?;
        Self::parse_envelope::<CheckDeviceData>(resp).await
    }

    /// 拉取账号的会话列表（分页）
    ///
    /// `updated_at` 为上一页末尾会话的更新时间戳（Unix 秒），None = 第一页。
    /// 真实客户端游标序列化在 `lte_cursor` 对象下（`lte_cursor.pinned=false`）。
    pub async fn fetch_sessions(
        &self,
        token: &str,
        updated_at: Option<f64>,
    ) -> Result<FetchSessionsData, ClientError> {
        let mut query: Vec<(&str, String)> = vec![("lte_cursor.pinned", "false".to_string())];
        if let Some(ts) = updated_at {
            query.push(("lte_cursor.updated_at", ts.to_string()));
        }
        let resp = self
            .http
            .get(format!(
                "{}{}",
                self.api_base, ENDPOINT_CHAT_SESSION_FETCH_PAGE
            ))
            .headers(self.auth_headers(token)?)
            .query(&query)
            .send()
            .await?;
        Self::parse_envelope::<FetchSessionsData>(resp).await
    }

    pub async fn create_session(&self, token: &str) -> Result<String, ClientError> {
        let resp = self
            .http
            .post(format!("{}{}", self.api_base, ENDPOINT_CHAT_SESSION_CREATE))
            .headers(self.auth_headers(token)?)
            .json(&serde_json::json!({}))
            .send()
            .await?;
        let wrapper: CreateSessionWrapper = Self::parse_envelope(resp).await?;
        let data = wrapper.chat_session;
        Ok(data.id)
    }

    pub async fn delete_session(&self, token: &str, session_id: &str) -> Result<(), ClientError> {
        let resp = self
            .http
            .post(format!("{}{}", self.api_base, ENDPOINT_CHAT_SESSION_DELETE))
            .headers(self.auth_headers(token)?)
            .json(&serde_json::json!({ "chat_session_id": session_id }))
            .send()
            .await?;
        Self::parse_envelope::<Option<()>>(resp).await?;
        Ok(())
    }

    pub async fn create_pow_challenge(
        &self,
        token: &str,
        target_path: &str,
    ) -> Result<ChallengeData, ClientError> {
        let resp = self
            .http
            .post(format!(
                "{}{}",
                self.api_base, ENDPOINT_CHAT_CREATE_POW_CHALLENGE
            ))
            .headers(self.auth_headers(token)?)
            .json(&serde_json::json!({ "target_path": target_path }))
            .send()
            .await?;
        let wrapper: ChallengeWrapper = Self::parse_envelope(resp).await?;
        let challenge = wrapper.challenge;
        Ok(challenge)
    }

    pub async fn completion(
        &self,
        token: &str,
        pow_response: &str,
        payload: &CompletionPayload,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<Bytes, ClientError>> + Send>>, ClientError> {
        let resp = self
            .http
            .post(format!("{}{}", self.api_base, ENDPOINT_CHAT_COMPLETION))
            .headers(self.auth_headers_with_pow(token, pow_response)?)
            .json(payload)
            .send()
            .await?;

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(ClientError::Status {
                status: status.as_u16(),
                body,
            });
        }

        Ok(Box::pin(resp.bytes_stream().map_err(ClientError::Http)))
    }

    #[allow(dead_code)]
    pub async fn edit_message(
        &self,
        token: &str,
        pow_response: &str,
        payload: &EditMessagePayload,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<Bytes, ClientError>> + Send>>, ClientError> {
        let resp = self
            .http
            .post(format!("{}{}", self.api_base, ENDPOINT_CHAT_EDIT_MESSAGE))
            .headers(self.auth_headers_with_pow(token, pow_response)?)
            .json(payload)
            .send()
            .await?;

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(ClientError::Status {
                status: status.as_u16(),
                body,
            });
        }

        Ok(Box::pin(resp.bytes_stream().map_err(ClientError::Http)))
    }

    #[allow(dead_code)]
    pub async fn update_title(
        &self,
        token: &str,
        payload: &UpdateTitlePayload,
    ) -> Result<(), ClientError> {
        let resp = self
            .http
            .post(format!(
                "{}{}",
                self.api_base, ENDPOINT_CHAT_SESSION_UPDATE_TITLE
            ))
            .headers(self.auth_headers(token)?)
            .json(payload)
            .send()
            .await?;
        Self::parse_envelope::<serde::de::IgnoredAny>(resp).await?;
        Ok(())
    }

    /// 取消正在进行的流式输出，不需要 PoW
    pub async fn stop_stream(
        &self,
        token: &str,
        payload: &StopStreamPayload,
    ) -> Result<(), ClientError> {
        let resp = self
            .http
            .post(format!("{}{}", self.api_base, ENDPOINT_CHAT_STOP_STREAM))
            .headers(self.auth_headers(token)?)
            .json(payload)
            .send()
            .await?;
        Self::parse_envelope::<Option<()>>(resp).await?;
        Ok(())
    }

    /// 上传文件，返回文件元数据（id, status 等）
    pub async fn upload_file(
        &self,
        token: &str,
        pow_response: &str,
        filename: &str,
        content_type: &str,
        bytes: Vec<u8>,
    ) -> Result<UploadFileData, ClientError> {
        let part = Part::bytes(bytes)
            .file_name(filename.to_string())
            .mime_str(content_type)?;
        let form = Form::new().part("file", part);

        let resp = self
            .http
            .post(format!("{}{}", self.api_base, ENDPOINT_FILE_UPLOAD))
            .headers(self.auth_headers_with_pow(token, pow_response)?)
            .multipart(form)
            .send()
            .await?;
        Self::parse_envelope::<UploadFileData>(resp).await
    }

    /// 查询文件状态，返回文件列表（含 status: PENDING/SUCCESS/FAILED）
    pub async fn fetch_files(
        &self,
        token: &str,
        file_ids: &[String],
    ) -> Result<FetchFilesData, ClientError> {
        let ids = file_ids.join(",");
        let resp = self
            .http
            .get(format!("{}{}", self.api_base, ENDPOINT_FILE_FETCH))
            .headers(self.auth_headers(token)?)
            .query(&[("file_ids", &ids)])
            .send()
            .await?;
        Self::parse_envelope::<FetchFilesData>(resp).await
    }

    pub async fn get_wasm(&self) -> Result<Bytes, ClientError> {
        let resp = self.http.get(&self.wasm_url).send().await?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(ClientError::Status {
                status: status.as_u16(),
                body,
            });
        }
        Ok(resp.bytes().await?)
    }
}

/// 由种子字节确定性派生设备 UUID（RFC 4122 v4 格式）
///
/// 真实客户端每个安装一个持久设备 UUID；代理侧多账号共享一个客户端实例，
/// 因此按 api_base 派生：同一配置重启后设备身份不变（每次重启都变会呈现为
/// 「无限多个新设备」，本身就是风控信号）。
pub(crate) fn derive_device_uuid(seed: &[u8]) -> String {
    fn fnv1a(data: &[u8], offset: u64) -> u64 {
        let mut hash = 0xcbf2_9ce4_8422_2325u64 ^ offset;
        for &b in data {
            hash ^= u64::from(b);
            hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
        }
        hash
    }
    let hi = fnv1a(seed, 0);
    let lo = fnv1a(seed, 0x9e37_79b9_7f4a_7c15);
    let mut b = [0u8; 16];
    b[..8].copy_from_slice(&hi.to_be_bytes());
    b[8..].copy_from_slice(&lo.to_be_bytes());
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
    let hex: Vec<String> = b.iter().map(|x| format!("{x:02x}")).collect();
    format!(
        "{}{}{}{}-{}{}-{}{}-{}{}-{}{}{}{}{}{}",
        hex[0],
        hex[1],
        hex[2],
        hex[3],
        hex[4],
        hex[5],
        hex[6],
        hex[7],
        hex[8],
        hex[9],
        hex[10],
        hex[11],
        hex[12],
        hex[13],
        hex[14],
        hex[15]
    )
}

/// 解析 check_device 的 rotate 指令，提取新令牌
///
/// 形态未知（未观测到非 null 值）：兼容字符串与 `{"token": "..."}` 对象，
/// 其余形态返回 None（记录日志由调用方处理）。
pub(crate) fn extract_rotate_token(rotate: &serde_json::Value) -> Option<String> {
    match rotate {
        serde_json::Value::String(s) if !s.is_empty() => Some(s.clone()),
        serde_json::Value::Object(map) => map
            .get("token")
            .and_then(serde_json::Value::as_str)
            .filter(|s| !s.is_empty())
            .map(str::to_string),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_client() -> DsClient {
        DsClient::new(
            "https://chat.deepseek.com/api/v0".to_string(),
            "https://example.com/x.wasm".to_string(),
            "DeepSeek/2.5.0 Android/35".to_string(),
            "2.5.0".to_string(),
            "android".to_string(),
            "zh_CN".to_string(),
            "com.deepseek.chat".to_string(),
            String::new(),
            String::new(),
            "28800".to_string(),
            "android".to_string(),
            None,
        )
    }

    #[test]
    fn device_uuid_is_deterministic_and_well_formed() {
        let a = derive_device_uuid(b"https://chat.deepseek.com/api/v0");
        let b = derive_device_uuid(b"https://chat.deepseek.com/api/v0");
        assert_eq!(a, b, "同一 seed 必须派生同一 UUID");
        assert_eq!(a.len(), 36);
        assert_eq!(a.matches('-').count(), 4);
        assert_eq!(&a[14..15], "4", "version 4");
        assert!(
            matches!(a.as_bytes()[19], b'8' | b'9' | b'a' | b'b'),
            "variant"
        );
        assert_ne!(
            derive_device_uuid(b"https://other.example/api"),
            a,
            "不同 seed 应派生不同 UUID"
        );
    }

    #[test]
    fn client_headers_match_real_client_shape() {
        let c = test_client();
        let h = c.client_headers().expect("headers");
        for name in [
            "user-agent",
            "x-client-version",
            "x-client-platform",
            "x-client-locale",
            "x-client-bundle-id",
            "x-device-id",
            "x-device-model",
            "x-client-timezone-offset",
        ] {
            assert!(h.contains_key(name), "缺少请求头 {name}");
        }
        assert_eq!(h["x-client-version"], "2.5.0");
        assert_eq!(h["x-client-platform"], "android");
        assert_eq!(h["x-device-model"], "");
        assert_eq!(h["x-client-timezone-offset"], "28800");
        // X-Device-Id 必须是 UUID 形态（api_base 派生）
        assert_eq!(h["x-device-id"].len(), 36);
    }

    #[test]
    fn device_id_config_override_wins() {
        let c = DsClient::new(
            "https://chat.deepseek.com/api/v0".to_string(),
            "https://example.com/x.wasm".to_string(),
            "UA".to_string(),
            "2.5.0".to_string(),
            "android".to_string(),
            "zh_CN".to_string(),
            "com.deepseek.chat".to_string(),
            "11111111-2222-4333-8444-555555555555".to_string(),
            String::new(),
            "28800".to_string(),
            "android".to_string(),
            None,
        );
        assert_eq!(
            c.client_headers().unwrap()["x-device-id"],
            "11111111-2222-4333-8444-555555555555"
        );
    }

    #[test]
    fn chat_status_accepts_int_and_bool_mute_flags() {
        let int_form: ChatStatus =
            serde_json::from_str(r#"{"is_muted":1,"mute_until":1790397239.972}"#).unwrap();
        assert_eq!(int_form.is_muted, 1);
        assert_eq!(int_form.mute_until, Some(1_790_397_239.972));

        let bool_form: ChatStatus = serde_json::from_str(r#"{"is_muted":false}"#).unwrap();
        assert_eq!(bool_form.is_muted, 0);
        assert_eq!(bool_form.mute_until, None);

        // 缺失 chat 字段 = 未禁言
        let user: UserInfo = serde_json::from_str(r#"{"id":"u","token":"t"}"#).unwrap();
        assert!(user.chat.is_none());
    }

    #[test]
    fn check_device_rotate_parsing() {
        let null_rotate: CheckDeviceData = serde_json::from_str(r#"{"rotate":null}"#).unwrap();
        assert!(null_rotate.rotate.is_none());

        let str_rotate: CheckDeviceData =
            serde_json::from_str(r#"{"rotate":"new-token"}"#).unwrap();
        assert_eq!(
            extract_rotate_token(str_rotate.rotate.as_ref().unwrap()).as_deref(),
            Some("new-token")
        );

        let obj_rotate: CheckDeviceData =
            serde_json::from_str(r#"{"rotate":{"token":"obj-token"}}"#).unwrap();
        assert_eq!(
            extract_rotate_token(obj_rotate.rotate.as_ref().unwrap()).as_deref(),
            Some("obj-token")
        );

        let junk: serde_json::Value = serde_json::from_str(r#"{"foo":1}"#).unwrap();
        assert!(extract_rotate_token(&junk).is_none());
    }

    #[test]
    fn fetch_sessions_response_parsing() {
        let data: FetchSessionsData = serde_json::from_str(
            r#"{"chat_sessions":[
                {"id":"97952d9b","title":"命令行命令翻译","title_type":"SYSTEM",
                 "pinned":false,"model_type":"default","updated_at":1778039195.997},
                {"id":"5be62e10","title":null,"pinned":true}
            ],"has_more":true}"#,
        )
        .unwrap();
        assert_eq!(data.chat_sessions.len(), 2);
        assert_eq!(data.has_more, Some(true));
        assert_eq!(
            data.chat_sessions[0].title.as_deref(),
            Some("命令行命令翻译")
        );
        assert_eq!(data.chat_sessions[0].updated_at, Some(1_778_039_195.997));
        assert!(data.chat_sessions[1].title.is_none());
        assert!(data.chat_sessions[1].model_type.is_none());
        assert!(data.chat_sessions[1].updated_at.is_none());

        // 空响应（无会话账号）
        let empty: FetchSessionsData = serde_json::from_str(r#"{"chat_sessions":[]}"#).unwrap();
        assert!(empty.chat_sessions.is_empty());
        assert_eq!(empty.has_more, None);
    }
}
