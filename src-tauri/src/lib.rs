// 导入tracing日志宏和级别定义
use tracing::{info, warn, error, debug};
// 导入tracing_subscriber的格式化模块和预设模块
use tracing_subscriber::{fmt, prelude::*};
// 导入环境变量过滤器，用于控制日志级别
use tracing_subscriber::filter::EnvFilter;
// 导入serde用于序列化和反序列化
use serde::{Deserialize, Serialize};
// 导入reqwest用于HTTP请求
use reqwest::{Client, Proxy};
// 导入std库用于HashMap和错误处理
use std::collections::HashMap;
use std::time::Duration;

/// 代理配置结构体
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ProxyConfig {
    pub enabled: bool,
    pub proxy_type: String, // "http", "https", "socks5"
    pub host: String,
    pub port: u16,
    pub requires_auth: bool,
    pub username: Option<String>,
    pub password: Option<String>,
}

/// HTTP请求参数结构体
#[derive(Debug, Deserialize)]
pub struct HttpRequestParams {
    pub url: String,
    pub method: String,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
    pub proxy_config: Option<ProxyConfig>,
}

/// HTTP响应结构体
#[derive(Debug, Serialize)]
pub struct HttpResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub success: bool,
    pub error: Option<String>,
}

/// 创建HTTP客户端，支持代理配置
fn create_http_client(proxy_config: Option<&ProxyConfig>) -> Result<Client, Box<dyn std::error::Error + Send + Sync>> {
    let mut client_builder = Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent("AiChat/1.0");

    if let Some(config) = proxy_config {
        if config.enabled {
            let proxy_url = match config.proxy_type.as_str() {
                "http" => format!("http://{}:{}", config.host, config.port),
                "https" => format!("https://{}:{}", config.host, config.port),
                "socks5" => format!("socks5://{}:{}", config.host, config.port),
                _ => return Err("不支持的代理类型".into()),
            };

            info!("使用代理: {} (类型: {})", proxy_url, config.proxy_type);

            let mut proxy = Proxy::all(&proxy_url)?;

            // 如果需要认证
            if config.requires_auth {
                if let (Some(username), Some(password)) = (&config.username, &config.password) {
                    proxy = proxy.basic_auth(username, password);
                    info!("代理认证已配置");
                }
            }

            client_builder = client_builder.proxy(proxy);
        }
    }

    Ok(client_builder.build()?)
}

/// 发送HTTP请求的Tauri命令
#[tauri::command]
async fn send_http_request(params: HttpRequestParams) -> Result<HttpResponse, String> {
    info!("发送HTTP请求到: {}", params.url);
    debug!("请求方法: {}", params.method);

    // 创建HTTP客户端
    let client = create_http_client(params.proxy_config.as_ref())
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;

    // 构建请求
    let mut request_builder = match params.method.to_uppercase().as_str() {
        "GET" => client.get(&params.url),
        "POST" => client.post(&params.url),
        "PUT" => client.put(&params.url),
        "DELETE" => client.delete(&params.url),
        _ => return Err("不支持的HTTP方法".to_string()),
    };

    // 添加请求头
    if let Some(headers) = params.headers {
        for (key, value) in headers {
            request_builder = request_builder.header(&key, &value);
        }
    }

    // 添加请求体
    if let Some(body) = params.body {
        request_builder = request_builder.body(body);
    }

    // 发送请求
    match request_builder.send().await {
        Ok(response) => {
            let status = response.status().as_u16();
            
            // 提取响应头
            let mut headers = HashMap::new();
            for (name, value) in response.headers() {
                if let Ok(value_str) = value.to_str() {
                    headers.insert(name.to_string(), value_str.to_string());
                }
            }

            // 获取响应体
            match response.text().await {
                Ok(body) => {
                    info!("HTTP请求成功，状态码: {}", status);
                    Ok(HttpResponse {
                        status,
                        headers,
                        body,
                        success: status >= 200 && status < 300,
                        error: None,
                    })
                }
                Err(e) => {
                    error!("读取响应体失败: {}", e);
                    Err(format!("读取响应体失败: {}", e))
                }
            }
        }
        Err(e) => {
            error!("HTTP请求失败: {}", e);
            Err(format!("HTTP请求失败: {}", e))
        }
    }
}

/// 测试代理连接的Tauri命令
#[tauri::command]
async fn test_proxy_connection(proxy_config: ProxyConfig) -> Result<String, String> {
    info!("测试代理连接: {}:{} (类型: {})", proxy_config.host, proxy_config.port, proxy_config.proxy_type);

    let client = create_http_client(Some(&proxy_config))
        .map_err(|e| format!("创建代理客户端失败: {}", e))?;

    // 使用Google来测试代理（验证是否能访问被墙的网站）
    let test_url = "https://www.google.com";
    
    match client.get(test_url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                let status_code = response.status().as_u16();
                info!("代理测试成功，状态码: {}", status_code);
                Ok(format!("代理连接成功！已成功访问 Google (状态码: {})", status_code))
            } else {
                Err(format!("代理测试失败，状态码: {}", response.status()))
            }
        }
        Err(e) => {
            error!("代理测试失败: {}", e);
            Err(format!("代理连接失败: {}", e))
        }
    }
}

/// 记录信息级别日志的命令
/// 
/// # 参数
/// * `message` - 要记录的日志消息
/// 
/// # 示例
/// ```
/// invoke("log_info", { message: "应用启动成功" })
/// ```
#[tauri::command]
fn log_info(message: String) {
    info!("{}", message);
}

/// 记录警告级别日志的命令
/// 
/// # 参数
/// * `message` - 要记录的警告消息
/// 
/// # 示例
/// ```
/// invoke("log_warn", { message: "API密钥未设置" })
/// ```
#[tauri::command]
fn log_warn(message: String) {
    warn!("{}", message);
}

/// 记录错误级别日志的命令
/// 
/// # 参数
/// * `message` - 要记录的错误消息
/// 
/// # 示例
/// ```
/// invoke("log_error", { message: "连接API失败" })
/// ```
#[tauri::command]
fn log_error(message: String) {
    error!("{}", message);
}

/// 记录调试级别日志的命令
/// 
/// # 参数
/// * `message` - 要记录的调试消息
/// 
/// # 示例
/// ```
/// invoke("log_debug", { message: "开始加载设置" })
/// ```
#[tauri::command]
fn log_debug(message: String) {
    debug!("{}", message);
}

/// 初始化tracing日志系统
/// 
/// 此函数设置并初始化tracing日志系统，优先使用环境变量中的配置，
/// 如果未找到则默认使用info级别。
fn init_tracing() {
    // 尝试从环境变量获取日志级别配置，若失败则使用info级别
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    // 配置并初始化日志订阅器
    tracing_subscriber::registry()
        .with(fmt::layer()) // 添加格式化层
        .with(filter)      // 添加过滤器层
        .init();           // 初始化
    
    // 记录初始化完成的日志
    info!("日志系统初始化完成");
}

/// 应用程序入口点
/// 
/// 此函数是Tauri应用的主入口点，负责初始化日志系统、
/// 配置应用实例并注册命令处理器。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志系统
    init_tracing();
    
    // 记录应用启动日志
    info!("应用程序启动");
    
    // 创建并配置Tauri应用
    tauri::Builder::default()
        // 设置应用
        .setup(|app| {
            info!("应用程序设置完成");
            Ok(())
        })
        // 注册命令处理器
        .invoke_handler(tauri::generate_handler![
            log_info,
            log_warn,
            log_error,
            log_debug,
            send_http_request,
            test_proxy_connection
        ])
        // 运行应用
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
