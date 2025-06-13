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
// 导入文件系统相关模块
use std::fs;
use std::path::{Path, PathBuf};
use std::io;
use regex::Regex;
// chrono用于时间格式化，但实际使用的是std::time

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

/// 文件系统操作结果结构体
#[derive(Debug, Serialize)]
pub struct FileSystemResult {
    pub success: bool,
    pub data: Option<String>,
    pub error: Option<String>,
}

/// 目录项结构体
#[derive(Debug, Serialize)]
pub struct DirectoryItem {
    pub name: String,
    pub item_type: String, // "file" or "directory"
    pub size: Option<u64>,
    pub modified: Option<String>,
}

/// 文件信息结构体
#[derive(Debug, Serialize)]
pub struct FileInfo {
    pub name: String,
    pub item_type: String, // "file" or "directory"
    pub size: u64,
    pub created: Option<String>,
    pub modified: Option<String>,
    pub accessed: Option<String>,
    pub permissions: String,
}

/// 搜索选项结构体
#[derive(Debug, Deserialize)]
pub struct SearchOptions {
    pub recursive: Option<bool>,
    pub case_sensitive: Option<bool>,
    pub file_only: Option<bool>,
}

/// 创建HTTP客户端，支持代理配置
fn create_http_client(proxy_config: Option<&ProxyConfig>) -> Result<Client, Box<dyn std::error::Error + Send + Sync>> {
    let mut client_builder = Client::builder()
        .timeout(Duration::from_secs(300)) // 增加到5分钟超时
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

/// 创建流式HTTP客户端，支持代理配置，无超时限制
fn create_stream_http_client(proxy_config: Option<&ProxyConfig>) -> Result<Client, Box<dyn std::error::Error + Send + Sync>> {
    let mut client_builder = Client::builder()
        .user_agent("AiChat/1.0");
    // 流式请求不设置超时，因为需要持续接收数据

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

            info!("使用流式代理: {} (类型: {})", proxy_url, config.proxy_type);

            let mut proxy = Proxy::all(&proxy_url)?;

            // 如果需要认证
            if config.requires_auth {
                if let (Some(username), Some(password)) = (&config.username, &config.password) {
                    proxy = proxy.basic_auth(username, password);
                    info!("流式代理认证已配置");
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
    
    // 创建流式HTTP客户端（无超时限制）
    let client = create_stream_http_client(params.proxy_config.as_ref())
        .map_err(|e| format!("创建流式HTTP客户端失败: {}", e))?;

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
                            if let Ok(text) = std::str::from_utf8(&chunk) {
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

/// 文件系统安全检查
fn is_path_safe(path: &str) -> bool {
    let path = Path::new(path);
    
    // 检查是否包含危险的路径组件
    for component in path.components() {
        match component {
            std::path::Component::ParentDir => return false, // 不允许 ".."
            std::path::Component::RootDir => return false,   // 不允许绝对路径
            _ => {}
        }
    }
    
    // 检查文件扩展名
    if let Some(extension) = path.extension() {
        let ext = extension.to_string_lossy().to_lowercase();
        let allowed_extensions = [
            "txt", "md", "json", "js", "ts", "jsx", "tsx",
            "css", "scss", "html", "xml", "yaml", "yml",
            "py", "java", "cpp", "c", "h", "cs", "php",
            "rb", "go", "rs", "swift", "kt", "scala",
            "sql", "sh", "bat", "ps1", "dockerfile",
            "gitignore", "env", "config", "ini", "toml"
        ];
        
        if !allowed_extensions.contains(&ext.as_str()) && !ext.is_empty() {
            return false;
        }
    }
    
    true
}

/// 获取权限字符串（跨平台兼容）
fn get_permissions_string(metadata: &fs::Metadata) -> String {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        format!("{:o}", metadata.permissions().mode())
    }
    #[cfg(windows)]
    {
        if metadata.permissions().readonly() {
            "readonly".to_string()
        } else {
            "readwrite".to_string()
        }
    }
}

/// 获取安全的绝对路径
fn get_safe_path(path: &str) -> Result<PathBuf, String> {
    if !is_path_safe(path) {
        return Err("路径不安全或文件类型不被支持".to_string());
    }
    
    let current_dir = std::env::current_dir()
        .map_err(|e| format!("无法获取当前目录: {}", e))?;
    
    let full_path = if Path::new(path).is_absolute() {
        return Err("不允许使用绝对路径".to_string());
    } else {
        current_dir.join(path)
    };
    
    // 确保路径在当前目录下
    let canonical_current = current_dir.canonicalize()
        .map_err(|e| format!("无法规范化当前目录: {}", e))?;
    
    if let Ok(canonical_path) = full_path.canonicalize() {
        if !canonical_path.starts_with(&canonical_current) {
            return Err("路径超出允许范围".to_string());
        }
    }
    
    Ok(full_path)
}

/// 读取文件内容的Tauri命令
#[tauri::command]
async fn fs_read_file(path: String) -> Result<FileSystemResult, String> {
    info!("读取文件: {}", path);
    
    match get_safe_path(&path) {
        Ok(safe_path) => {
            match fs::read_to_string(&safe_path) {
                Ok(content) => {
                    info!("文件读取成功: {} ({} 字符)", path, content.len());
                    Ok(FileSystemResult {
                        success: true,
                        data: Some(content),
                        error: None,
                    })
                }
                Err(e) => {
                    error!("文件读取失败: {} - {}", path, e);
                    Ok(FileSystemResult {
                        success: false,
                        data: None,
                        error: Some(format!("读取文件失败: {}", e)),
                    })
                }
            }
        }
        Err(e) => {
            error!("路径验证失败: {} - {}", path, e);
            Ok(FileSystemResult {
                success: false,
                data: None,
                error: Some(e),
            })
        }
    }
}

/// 写入文件内容的Tauri命令
#[tauri::command]
async fn fs_write_file(path: String, content: String) -> Result<FileSystemResult, String> {
    info!("写入文件: {} ({} 字符)", path, content.len());
    
    // 检查内容大小（10MB限制）
    if content.len() > 10 * 1024 * 1024 {
        return Ok(FileSystemResult {
            success: false,
            data: None,
            error: Some("文件内容过大，超过10MB限制".to_string()),
        });
    }
    
    match get_safe_path(&path) {
        Ok(safe_path) => {
            // 确保父目录存在
            if let Some(parent) = safe_path.parent() {
                if let Err(e) = fs::create_dir_all(parent) {
                    return Ok(FileSystemResult {
                        success: false,
                        data: None,
                        error: Some(format!("创建父目录失败: {}", e)),
                    });
                }
            }
            
            match fs::write(&safe_path, &content) {
                Ok(_) => {
                    info!("文件写入成功: {}", path);
                    Ok(FileSystemResult {
                        success: true,
                        data: Some(format!("文件已写入: {} ({} 字符)", path, content.len())),
                        error: None,
                    })
                }
                Err(e) => {
                    error!("文件写入失败: {} - {}", path, e);
                    Ok(FileSystemResult {
                        success: false,
                        data: None,
                        error: Some(format!("写入文件失败: {}", e)),
                    })
                }
            }
        }
        Err(e) => {
            error!("路径验证失败: {} - {}", path, e);
            Ok(FileSystemResult {
                success: false,
                data: None,
                error: Some(e),
            })
        }
    }
}

/// 列出目录内容的Tauri命令
#[tauri::command]
async fn fs_list_directory(path: String) -> Result<FileSystemResult, String> {
    info!("列出目录: {}", path);
    
    match get_safe_path(&path) {
        Ok(safe_path) => {
            match fs::read_dir(&safe_path) {
                Ok(entries) => {
                    let mut items = Vec::new();
                    
                    for entry in entries {
                        if let Ok(entry) = entry {
                            let metadata = entry.metadata();
                            let name = entry.file_name().to_string_lossy().to_string();
                            
                            if let Ok(metadata) = metadata {
                                let item = DirectoryItem {
                                    name,
                                    item_type: if metadata.is_dir() { "directory".to_string() } else { "file".to_string() },
                                    size: if metadata.is_file() { Some(metadata.len()) } else { None },
                                    modified: metadata.modified().ok()
                                        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                                        .map(|duration| {
                                            let datetime = chrono::DateTime::from_timestamp(duration.as_secs() as i64, 0);
                                            datetime.map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
                                                .unwrap_or_else(|| "Unknown".to_string())
                                        }),
                                };
                                items.push(item);
                            }
                        }
                    }
                    
                    let result = serde_json::to_string(&items)
                        .map_err(|e| format!("序列化失败: {}", e))?;
                    
                    info!("目录列出成功: {} ({} 项)", path, items.len());
                    Ok(FileSystemResult {
                        success: true,
                        data: Some(result),
                        error: None,
                    })
                }
                Err(e) => {
                    error!("目录列出失败: {} - {}", path, e);
                    Ok(FileSystemResult {
                        success: false,
                        data: None,
                        error: Some(format!("列出目录失败: {}", e)),
                    })
                }
            }
        }
        Err(e) => {
            error!("路径验证失败: {} - {}", path, e);
            Ok(FileSystemResult {
                success: false,
                data: None,
                error: Some(e),
            })
        }
    }
}

/// 创建目录的Tauri命令
#[tauri::command]
async fn fs_create_directory(path: String) -> Result<FileSystemResult, String> {
    info!("创建目录: {}", path);
    
    match get_safe_path(&path) {
        Ok(safe_path) => {
            match fs::create_dir_all(&safe_path) {
                Ok(_) => {
                    info!("目录创建成功: {}", path);
                    Ok(FileSystemResult {
                        success: true,
                        data: Some(format!("目录已创建: {}", path)),
                        error: None,
                    })
                }
                Err(e) => {
                    error!("目录创建失败: {} - {}", path, e);
                    Ok(FileSystemResult {
                        success: false,
                        data: None,
                        error: Some(format!("创建目录失败: {}", e)),
                    })
                }
            }
        }
        Err(e) => {
            error!("路径验证失败: {} - {}", path, e);
            Ok(FileSystemResult {
                success: false,
                data: None,
                error: Some(e),
            })
        }
    }
}

/// 删除文件的Tauri命令
#[tauri::command]
async fn fs_delete_file(path: String) -> Result<FileSystemResult, String> {
    info!("删除文件: {}", path);
    
    match get_safe_path(&path) {
        Ok(safe_path) => {
            if !safe_path.is_file() {
                return Ok(FileSystemResult {
                    success: false,
                    data: None,
                    error: Some("指定路径不是文件".to_string()),
                });
            }
            
            match fs::remove_file(&safe_path) {
                Ok(_) => {
                    info!("文件删除成功: {}", path);
                    Ok(FileSystemResult {
                        success: true,
                        data: Some(format!("文件已删除: {}", path)),
                        error: None,
                    })
                }
                Err(e) => {
                    error!("文件删除失败: {} - {}", path, e);
                    Ok(FileSystemResult {
                        success: false,
                        data: None,
                        error: Some(format!("删除文件失败: {}", e)),
                    })
                }
            }
        }
        Err(e) => {
            error!("路径验证失败: {} - {}", path, e);
            Ok(FileSystemResult {
                success: false,
                data: None,
                error: Some(e),
            })
        }
    }
}

/// 删除目录的Tauri命令
#[tauri::command]
async fn fs_delete_directory(path: String) -> Result<FileSystemResult, String> {
    info!("删除目录: {}", path);
    
    match get_safe_path(&path) {
        Ok(safe_path) => {
            if !safe_path.is_dir() {
                return Ok(FileSystemResult {
                    success: false,
                    data: None,
                    error: Some("指定路径不是目录".to_string()),
                });
            }
            
            match fs::remove_dir_all(&safe_path) {
                Ok(_) => {
                    info!("目录删除成功: {}", path);
                    Ok(FileSystemResult {
                        success: true,
                        data: Some(format!("目录已删除: {}", path)),
                        error: None,
                    })
                }
                Err(e) => {
                    error!("目录删除失败: {} - {}", path, e);
                    Ok(FileSystemResult {
                        success: false,
                        data: None,
                        error: Some(format!("删除目录失败: {}", e)),
                    })
                }
            }
        }
        Err(e) => {
            error!("路径验证失败: {} - {}", path, e);
            Ok(FileSystemResult {
                success: false,
                data: None,
                error: Some(e),
            })
        }
    }
}

/// 移动/重命名文件或目录的Tauri命令
#[tauri::command]
async fn fs_move_item(source: String, target: String) -> Result<FileSystemResult, String> {
    info!("移动项目: {} -> {}", source, target);
    
    let source_path = match get_safe_path(&source) {
        Ok(path) => path,
        Err(e) => return Ok(FileSystemResult {
            success: false,
            data: None,
            error: Some(format!("源路径验证失败: {}", e)),
        }),
    };
    
    let target_path = match get_safe_path(&target) {
        Ok(path) => path,
        Err(e) => return Ok(FileSystemResult {
            success: false,
            data: None,
            error: Some(format!("目标路径验证失败: {}", e)),
        }),
    };
    
    match fs::rename(&source_path, &target_path) {
        Ok(_) => {
            info!("移动成功: {} -> {}", source, target);
            Ok(FileSystemResult {
                success: true,
                data: Some(format!("已移动: {} -> {}", source, target)),
                error: None,
            })
        }
        Err(e) => {
            error!("移动失败: {} -> {} - {}", source, target, e);
            Ok(FileSystemResult {
                success: false,
                data: None,
                error: Some(format!("移动失败: {}", e)),
            })
        }
    }
}

/// 复制文件的Tauri命令
#[tauri::command]
async fn fs_copy_file(source: String, target: String) -> Result<FileSystemResult, String> {
    info!("复制文件: {} -> {}", source, target);
    
    let source_path = match get_safe_path(&source) {
        Ok(path) => path,
        Err(e) => return Ok(FileSystemResult {
            success: false,
            data: None,
            error: Some(format!("源路径验证失败: {}", e)),
        }),
    };
    
    let target_path = match get_safe_path(&target) {
        Ok(path) => path,
        Err(e) => return Ok(FileSystemResult {
            success: false,
            data: None,
            error: Some(format!("目标路径验证失败: {}", e)),
        }),
    };
    
    if !source_path.is_file() {
        return Ok(FileSystemResult {
            success: false,
            data: None,
            error: Some("源路径不是文件".to_string()),
        });
    }
    
    // 确保目标目录存在
    if let Some(parent) = target_path.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            return Ok(FileSystemResult {
                success: false,
                data: None,
                error: Some(format!("创建目标目录失败: {}", e)),
            });
        }
    }
    
    match fs::copy(&source_path, &target_path) {
        Ok(_) => {
            info!("复制成功: {} -> {}", source, target);
            Ok(FileSystemResult {
                success: true,
                data: Some(format!("文件已复制: {} -> {}", source, target)),
                error: None,
            })
        }
        Err(e) => {
            error!("复制失败: {} -> {} - {}", source, target, e);
            Ok(FileSystemResult {
                success: false,
                data: None,
                error: Some(format!("复制文件失败: {}", e)),
            })
        }
    }
}

/// 获取文件或目录信息的Tauri命令
#[tauri::command]
async fn fs_get_item_info(path: String) -> Result<FileSystemResult, String> {
    info!("获取项目信息: {}", path);
    
    match get_safe_path(&path) {
        Ok(safe_path) => {
            match fs::metadata(&safe_path) {
                Ok(metadata) => {
                    let name = safe_path.file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    
                    let info = FileInfo {
                        name,
                        item_type: if metadata.is_dir() { "directory".to_string() } else { "file".to_string() },
                        size: metadata.len(),
                        created: metadata.created().ok()
                            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|duration| {
                                let datetime = chrono::DateTime::from_timestamp(duration.as_secs() as i64, 0);
                                datetime.map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
                                    .unwrap_or_else(|| "Unknown".to_string())
                            }),
                        modified: metadata.modified().ok()
                            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|duration| {
                                let datetime = chrono::DateTime::from_timestamp(duration.as_secs() as i64, 0);
                                datetime.map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
                                    .unwrap_or_else(|| "Unknown".to_string())
                            }),
                        accessed: metadata.accessed().ok()
                            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|duration| {
                                let datetime = chrono::DateTime::from_timestamp(duration.as_secs() as i64, 0);
                                datetime.map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
                                    .unwrap_or_else(|| "Unknown".to_string())
                            }),
                        permissions: get_permissions_string(&metadata),
                    };
                    
                    let result = serde_json::to_string(&info)
                        .map_err(|e| format!("序列化失败: {}", e))?;
                    
                    info!("获取信息成功: {}", path);
                    Ok(FileSystemResult {
                        success: true,
                        data: Some(result),
                        error: None,
                    })
                }
                Err(e) => {
                    error!("获取信息失败: {} - {}", path, e);
                    Ok(FileSystemResult {
                        success: false,
                        data: None,
                        error: Some(format!("获取信息失败: {}", e)),
                    })
                }
            }
        }
        Err(e) => {
            error!("路径验证失败: {} - {}", path, e);
            Ok(FileSystemResult {
                success: false,
                data: None,
                error: Some(e),
            })
        }
    }
}

/// 搜索文件的Tauri命令
#[tauri::command]
async fn fs_search_files(path: String, pattern: String, options: SearchOptions) -> Result<FileSystemResult, String> {
    info!("搜索文件: {} 模式: {}", path, pattern);
    
    let recursive = options.recursive.unwrap_or(true);
    let case_sensitive = options.case_sensitive.unwrap_or(false);
    let file_only = options.file_only.unwrap_or(true);
    
    match get_safe_path(&path) {
        Ok(safe_path) => {
            let regex = match if case_sensitive {
                Regex::new(&pattern)
            } else {
                Regex::new(&format!("(?i){}", pattern))
            } {
                Ok(regex) => regex,
                Err(e) => return Ok(FileSystemResult {
                    success: false,
                    data: None,
                    error: Some(format!("正则表达式错误: {}", e)),
                }),
            };
            
            let mut results = Vec::new();
            
            fn search_dir(
                dir: &Path,
                regex: &Regex,
                recursive: bool,
                file_only: bool,
                results: &mut Vec<String>,
                base_path: &Path,
            ) -> io::Result<()> {
                if let Ok(entries) = fs::read_dir(dir) {
                    for entry in entries {
                        if let Ok(entry) = entry {
                            let path = entry.path();
                            let name = entry.file_name().to_string_lossy().to_string();
                            
                            if let Ok(metadata) = entry.metadata() {
                                if metadata.is_file() && regex.is_match(&name) {
                                    if let Ok(relative_path) = path.strip_prefix(base_path) {
                                        results.push(relative_path.to_string_lossy().to_string());
                                    }
                                } else if metadata.is_dir() {
                                    if !file_only && regex.is_match(&name) {
                                        if let Ok(relative_path) = path.strip_prefix(base_path) {
                                            results.push(relative_path.to_string_lossy().to_string());
                                        }
                                    }
                                    
                                    if recursive {
                                        let _ = search_dir(&path, regex, recursive, file_only, results, base_path);
                                    }
                                }
                            }
                        }
                    }
                }
                Ok(())
            }
            
            let base_path = std::env::current_dir()
                .map_err(|e| format!("无法获取当前目录: {}", e))?;
            
            if let Err(e) = search_dir(&safe_path, &regex, recursive, file_only, &mut results, &base_path) {
                return Ok(FileSystemResult {
                    success: false,
                    data: None,
                    error: Some(format!("搜索失败: {}", e)),
                });
            }
            
            let result = serde_json::to_string(&results)
                .map_err(|e| format!("序列化失败: {}", e))?;
            
            info!("搜索完成: {} 找到 {} 个结果", path, results.len());
            Ok(FileSystemResult {
                success: true,
                data: Some(result),
                error: None,
            })
        }
        Err(e) => {
            error!("路径验证失败: {} - {}", path, e);
            Ok(FileSystemResult {
                success: false,
                data: None,
                error: Some(e),
            })
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
        .setup(|_app| {
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
            test_proxy_connection,
            fs_read_file,
            fs_write_file,
            fs_list_directory,
            fs_create_directory,
            fs_delete_file,
            fs_delete_directory,
            fs_move_item,
            fs_copy_file,
            fs_get_item_info,
            fs_search_files
        ])
        // 运行应用
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
