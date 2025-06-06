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
// 导入std库用于HashMap、错误处理和流处理
use std::collections::HashMap;
use std::time::Duration;
use futures_util::stream::StreamExt;
use tauri::{AppHandle, Emitter};

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

/// 流式请求参数结构体
#[derive(Debug, Deserialize)]
pub struct StreamRequestParams {
    pub url: String,
    pub method: String,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
    pub proxy_config: Option<ProxyConfig>,
    pub stream_id: String, // 用于标识流式请求的唯一ID
}

/// 流式响应事件结构体
#[derive(Debug, Serialize, Clone)]
pub struct StreamEvent {
    pub stream_id: String,
    pub event_type: String, // "data", "end", "error"
    pub data: Option<String>,
    pub error: Option<String>,
}

/// 创建HTTP客户端，支持代理配置
fn create_http_client(proxy_config: Option<&ProxyConfig>) -> Result<Client, Box<dyn std::error::Error + Send + Sync>> {
    let mut client_builder = Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent("AiChat/1.0");

    if let Some(config) = proxy_config {
        if config.enabled {
            // 清理host中可能包含的协议前缀
            let clean_host = config.host
                .strip_prefix("http://")
                .or_else(|| config.host.strip_prefix("https://"))
                .or_else(|| config.host.strip_prefix("socks5://"))
                .unwrap_or(&config.host);

            let proxy_url = match config.proxy_type.as_str() {
                "http" => format!("http://{}:{}", clean_host, config.port),
                "https" => format!("https://{}:{}", clean_host, config.port),
                "socks5" => format!("socks5://{}:{}", clean_host, config.port),
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

/// 发送流式HTTP请求的Tauri命令
#[tauri::command]
async fn send_stream_request(app: AppHandle, params: StreamRequestParams) -> Result<String, String> {
    info!("发送流式HTTP请求到: {}", params.url);
    debug!("请求方法: {}, Stream ID: {}", params.method, params.stream_id);

    let stream_id = params.stream_id.clone();
    
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

    // 发送请求并处理流式响应
    match request_builder.send().await {
        Ok(response) => {
            let status = response.status().as_u16();
            info!("流式HTTP请求成功建立，状态码: {}", status);

            if !response.status().is_success() {
                let error_msg = format!("HTTP错误: {}", status);
                let _ = app.emit("stream-event", StreamEvent {
                    stream_id: stream_id.clone(),
                    event_type: "error".to_string(),
                    data: None,
                    error: Some(error_msg.clone()),
                });
                return Err(error_msg);
            }

            // 异步处理流式响应
            let app_clone = app.clone();
            let stream_id_clone = stream_id.clone();
            
            tokio::spawn(async move {
                let mut stream = response.bytes_stream();
                let mut chunk_count = 0;
                
                while let Some(chunk_result) = stream.next().await {
                    chunk_count += 1;
                    match chunk_result {
                        Ok(chunk) => {
                            info!("收到数据块 #{}: {} bytes", chunk_count, chunk.len());
                            
                            if let Ok(text) = std::str::from_utf8(&chunk) {
                                info!("数据块内容: {:?}", text);
                                
                                // 发送数据事件
                                let _ = app_clone.emit("stream-event", StreamEvent {
                                    stream_id: stream_id_clone.clone(),
                                    event_type: "data".to_string(),
                                    data: Some(text.to_string()),
                                    error: None,
                                });
                            } else {
                                warn!("数据块不是有效的UTF-8文本");
                            }
                        }
                        Err(e) => {
                            error!("读取流式数据失败: {}", e);
                            let _ = app_clone.emit("stream-event", StreamEvent {
                                stream_id: stream_id_clone.clone(),
                                event_type: "error".to_string(),
                                data: None,
                                error: Some(format!("读取流式数据失败: {}", e)),
                            });
                            break;
                        }
                    }
                }
                
                info!("流式数据接收完成，总共收到 {} 个数据块", chunk_count);
                
                // 发送结束事件
                let _ = app_clone.emit("stream-event", StreamEvent {
                    stream_id: stream_id_clone.clone(),
                    event_type: "end".to_string(),
                    data: None,
                    error: None,
                });
                
                info!("流式请求 {} 处理完成", stream_id_clone);
            });

            Ok(format!("流式请求已启动，Stream ID: {}", stream_id))
        }
        Err(e) => {
            error!("流式HTTP请求失败: {}", e);
            let error_msg = format!("流式HTTP请求失败: {}", e);
            let _ = app.emit("stream-event", StreamEvent {
                stream_id: stream_id.clone(),
                event_type: "error".to_string(),
                data: None,
                error: Some(error_msg.clone()),
            });
            Err(error_msg)
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
            send_stream_request,
            test_proxy_connection
        ])
        // 运行应用
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
