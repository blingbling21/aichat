// 导入tracing日志宏和级别定义
use tracing::{info, warn, error, debug};
// 导入tracing_subscriber的格式化模块和预设模块
use tracing_subscriber::{fmt, prelude::*};
// 导入环境变量过滤器，用于控制日志级别
use tracing_subscriber::filter::EnvFilter;

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
            log_debug
        ])
        // 运行应用
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
