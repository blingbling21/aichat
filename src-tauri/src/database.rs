use sqlx::{sqlite::SqlitePool, Pool, Sqlite, Row};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct AIProvider {
    pub id: String,
    pub name: String,
    pub api_endpoint: String,
    pub api_key: String,
    pub models: String, // JSON string
    pub default_model_id: Option<String>,
    pub custom_config: Option<String>, // JSON string
    pub use_custom_config: Option<bool>,
    pub auto_fetch_config: Option<String>, // JSON string
    pub preset_type: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProxySettings {
    pub id: i64,
    pub enabled: bool,
    pub proxy_type: String,
    pub host: String,
    pub port: i32,
    pub requires_auth: bool,
    pub username: String,
    pub password: String,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub description: String,
    pub system_prompt: String,
    pub provider_id: String,
    pub model_id: String,
    pub keep_history: bool,
    pub max_history_messages: Option<i32>,
    pub icon: Option<String>,
    pub is_stream_mode: Option<bool>,
    pub temperature: Option<f64>,
    pub settings: Option<String>, // JSON string
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentSession {
    pub id: String,
    pub agent_id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub session_id: String,
    pub content: String,
    pub role: String,
    pub timestamp: DateTime<Utc>,
    pub streaming: Option<bool>,
    pub canceled: Option<bool>,
    pub reasoning_content: Option<String>,
    pub reasoning_collapsed: Option<bool>,
    pub generation_start_time: Option<DateTime<Utc>>,
    pub generation_end_time: Option<DateTime<Utc>>,
    pub generation_duration: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Scene {
    pub id: String,
    pub name: String,
    pub description: String,
    pub scenario_prompt: String,
    pub participants: String, // JSON string
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SceneSession {
    pub id: String,
    pub scene_id: String,
    pub name: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SceneMessage {
    pub id: String,
    pub session_id: String,
    pub participant_id: String,
    pub agent_id: Option<String>,
    pub role: String,
    pub content: String,
    pub timestamp: DateTime<Utc>,
    pub metadata: Option<String>, // JSON string
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MCPServerConfig {
    pub id: String,
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub server_type: String,
    pub server_class: Option<String>,
    pub command: Option<String>,
    pub args: Option<String>, // JSON string
    pub env: Option<String>, // JSON string
    pub capabilities: String, // JSON string
    pub permissions: String, // JSON string
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppSettings {
    pub key: String,
    pub value: String,
    pub updated_at: DateTime<Utc>,
}

pub struct Database {
    pool: Pool<Sqlite>,
}

impl Database {
    pub async fn new() -> Result<Self, sqlx::Error> {
        let db_path = Self::get_db_path();
        
        // 确保数据库目录存在
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                sqlx::Error::Configuration(format!("Failed to create database directory: {}", e).into())
            })?;
        }
        
        // 使用正确的SQLite连接字符串格式
        let db_url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());
        
        let pool = SqlitePool::connect(&db_url).await?;
        
        let db = Database { pool };
        db.init_schema().await?;
        
        Ok(db)
    }
    
    fn get_db_path() -> PathBuf {
        // 使用系统应用数据目录，避免影响开发时的文件监听
        let mut path = match std::env::var("APPDATA") {
            Ok(appdata) => PathBuf::from(appdata),
            Err(_) => {
                // 如果获取APPDATA失败，使用当前目录下的data目录
                let mut path = std::env::current_dir().unwrap_or_default();
                path.push("data");
                path
            }
        };
        path.push("aichat");
        path.push("database.sqlite");
        path
    }
    
    async fn init_schema(&self) -> Result<(), sqlx::Error> {
        // AI Providers table
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS ai_providers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                api_endpoint TEXT NOT NULL,
                api_key TEXT NOT NULL,
                models TEXT NOT NULL,
                default_model_id TEXT,
                custom_config TEXT,
                use_custom_config BOOLEAN,
                auto_fetch_config TEXT,
                preset_type TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        "#).execute(&self.pool).await?;
        
        // Proxy Settings table
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS proxy_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                enabled BOOLEAN NOT NULL DEFAULT FALSE,
                proxy_type TEXT NOT NULL DEFAULT 'http',
                host TEXT NOT NULL DEFAULT '',
                port INTEGER NOT NULL DEFAULT 0,
                requires_auth BOOLEAN NOT NULL DEFAULT FALSE,
                username TEXT NOT NULL DEFAULT '',
                password TEXT NOT NULL DEFAULT '',
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        "#).execute(&self.pool).await?;
        
        // Agents table
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                system_prompt TEXT NOT NULL,
                provider_id TEXT NOT NULL,
                model_id TEXT NOT NULL,
                keep_history BOOLEAN NOT NULL DEFAULT TRUE,
                max_history_messages INTEGER,
                icon TEXT,
                is_stream_mode BOOLEAN,
                temperature REAL,
                settings TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        "#).execute(&self.pool).await?;
        
        // Agent Sessions table
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS agent_sessions (
                id TEXT PRIMARY KEY,
                agent_id TEXT NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE CASCADE
            )
        "#).execute(&self.pool).await?;
        
        // Messages table
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                content TEXT NOT NULL,
                role TEXT NOT NULL,
                timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                streaming BOOLEAN,
                canceled BOOLEAN,
                reasoning_content TEXT,
                reasoning_collapsed BOOLEAN,
                generation_start_time DATETIME,
                generation_end_time DATETIME,
                generation_duration INTEGER,
                FOREIGN KEY (session_id) REFERENCES agent_sessions (id) ON DELETE CASCADE
            )
        "#).execute(&self.pool).await?;
        
        // Scenes table
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS scenes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                scenario_prompt TEXT NOT NULL,
                participants TEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        "#).execute(&self.pool).await?;
        
        // Scene Sessions table
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS scene_sessions (
                id TEXT PRIMARY KEY,
                scene_id TEXT NOT NULL,
                name TEXT NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (scene_id) REFERENCES scenes (id) ON DELETE CASCADE
            )
        "#).execute(&self.pool).await?;
        
        // Scene Messages table
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS scene_messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                participant_id TEXT NOT NULL,
                agent_id TEXT,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT,
                FOREIGN KEY (session_id) REFERENCES scene_sessions (id) ON DELETE CASCADE
            )
        "#).execute(&self.pool).await?;
        
        // MCP Server Configs table
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS mcp_server_configs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                server_type TEXT NOT NULL,
                server_class TEXT,
                command TEXT,
                args TEXT,
                env TEXT,
                capabilities TEXT NOT NULL,
                permissions TEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        "#).execute(&self.pool).await?;
        
        // App Settings table
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        "#).execute(&self.pool).await?;
        
        // Create indexes for better query performance
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)").execute(&self.pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)").execute(&self.pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_id ON agent_sessions(agent_id)").execute(&self.pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_scene_messages_session_id ON scene_messages(session_id)").execute(&self.pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_scene_sessions_scene_id ON scene_sessions(scene_id)").execute(&self.pool).await?;
        
        Ok(())
    }
    
    pub fn pool(&self) -> &Pool<Sqlite> {
        &self.pool
    }
} 