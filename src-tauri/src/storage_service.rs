use crate::database::{Database, AIProvider, ProxySettings, Agent, AgentSession, Message, Scene, SceneSession, SceneMessage, MCPServerConfig, AppSettings};
use sqlx::{Row, Error as SqlxError};
use serde_json;
use chrono::Utc;
use uuid::Uuid;
use std::sync::Arc;

pub struct StorageService {
    db: Arc<Database>,
}

impl StorageService {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    // AI Providers
    pub async fn get_providers(&self) -> Result<Vec<AIProvider>, SqlxError> {
        let rows = sqlx::query("SELECT * FROM ai_providers ORDER BY created_at ASC")
            .fetch_all(self.db.pool())
            .await?;

        let mut providers = Vec::new();
        for row in rows {
            providers.push(AIProvider {
                id: row.get("id"),
                name: row.get("name"),
                api_endpoint: row.get("api_endpoint"),
                api_key: row.get("api_key"),
                models: row.get("models"),
                default_model_id: row.get("default_model_id"),
                custom_config: row.get("custom_config"),
                use_custom_config: row.get("use_custom_config"),
                auto_fetch_config: row.get("auto_fetch_config"),
                preset_type: row.get("preset_type"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            });
        }
        Ok(providers)
    }

    pub async fn save_provider(&self, provider: &AIProvider) -> Result<(), SqlxError> {
        sqlx::query(r#"
            INSERT OR REPLACE INTO ai_providers 
            (id, name, api_endpoint, api_key, models, default_model_id, custom_config, 
             use_custom_config, auto_fetch_config, preset_type, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#)
        .bind(&provider.id)
        .bind(&provider.name)
        .bind(&provider.api_endpoint)
        .bind(&provider.api_key)
        .bind(&provider.models)
        .bind(&provider.default_model_id)
        .bind(&provider.custom_config)
        .bind(&provider.use_custom_config)
        .bind(&provider.auto_fetch_config)
        .bind(&provider.preset_type)
        .bind(&provider.created_at)
        .bind(&provider.updated_at)
        .execute(self.db.pool())
        .await?;
        Ok(())
    }

    pub async fn delete_provider(&self, id: &str) -> Result<(), SqlxError> {
        sqlx::query("DELETE FROM ai_providers WHERE id = ?")
            .bind(id)
            .execute(self.db.pool())
            .await?;
        Ok(())
    }

    // Proxy Settings
    pub async fn get_proxy_settings(&self) -> Result<Option<ProxySettings>, SqlxError> {
        let row = sqlx::query("SELECT * FROM proxy_settings ORDER BY id DESC LIMIT 1")
            .fetch_optional(self.db.pool())
            .await?;

        if let Some(row) = row {
            Ok(Some(ProxySettings {
                id: row.get("id"),
                enabled: row.get("enabled"),
                proxy_type: row.get("proxy_type"),
                host: row.get("host"),
                port: row.get("port"),
                requires_auth: row.get("requires_auth"),
                username: row.get("username"),
                password: row.get("password"),
                updated_at: row.get("updated_at"),
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn save_proxy_settings(&self, settings: &ProxySettings) -> Result<(), SqlxError> {
        // 清空旧设置，插入新设置
        sqlx::query("DELETE FROM proxy_settings").execute(self.db.pool()).await?;
        
        sqlx::query(r#"
            INSERT INTO proxy_settings 
            (enabled, proxy_type, host, port, requires_auth, username, password, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#)
        .bind(&settings.enabled)
        .bind(&settings.proxy_type)
        .bind(&settings.host)
        .bind(&settings.port)
        .bind(&settings.requires_auth)
        .bind(&settings.username)
        .bind(&settings.password)
        .bind(&settings.updated_at)
        .execute(self.db.pool())
        .await?;
        Ok(())
    }

    // Agents
    pub async fn get_agents(&self) -> Result<Vec<Agent>, SqlxError> {
        let rows = sqlx::query("SELECT * FROM agents ORDER BY created_at ASC")
            .fetch_all(self.db.pool())
            .await?;

        let mut agents = Vec::new();
        for row in rows {
            agents.push(Agent {
                id: row.get("id"),
                name: row.get("name"),
                description: row.get("description"),
                system_prompt: row.get("system_prompt"),
                provider_id: row.get("provider_id"),
                model_id: row.get("model_id"),
                keep_history: row.get("keep_history"),
                max_history_messages: row.get("max_history_messages"),
                icon: row.get("icon"),
                is_stream_mode: row.get("is_stream_mode"),
                temperature: row.get("temperature"),
                settings: row.get("settings"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            });
        }
        Ok(agents)
    }

    pub async fn save_agent(&self, agent: &Agent) -> Result<(), SqlxError> {
        sqlx::query(r#"
            INSERT OR REPLACE INTO agents 
            (id, name, description, system_prompt, provider_id, model_id, keep_history, 
             max_history_messages, icon, is_stream_mode, temperature, settings, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#)
        .bind(&agent.id)
        .bind(&agent.name)
        .bind(&agent.description)
        .bind(&agent.system_prompt)
        .bind(&agent.provider_id)
        .bind(&agent.model_id)
        .bind(&agent.keep_history)
        .bind(&agent.max_history_messages)
        .bind(&agent.icon)
        .bind(&agent.is_stream_mode)
        .bind(&agent.temperature)
        .bind(&agent.settings)
        .bind(&agent.created_at)
        .bind(&agent.updated_at)
        .execute(self.db.pool())
        .await?;
        Ok(())
    }

    pub async fn delete_agent(&self, id: &str) -> Result<(), SqlxError> {
        sqlx::query("DELETE FROM agents WHERE id = ?")
            .bind(id)
            .execute(self.db.pool())
            .await?;
        Ok(())
    }

    // Agent Sessions
    pub async fn get_agent_sessions(&self) -> Result<Vec<AgentSession>, SqlxError> {
        let rows = sqlx::query("SELECT * FROM agent_sessions ORDER BY updated_at DESC")
            .fetch_all(self.db.pool())
            .await?;

        let mut sessions = Vec::new();
        for row in rows {
            sessions.push(AgentSession {
                id: row.get("id"),
                agent_id: row.get("agent_id"),
                name: row.get("name"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            });
        }
        Ok(sessions)
    }

    pub async fn save_agent_session(&self, session: &AgentSession) -> Result<(), SqlxError> {
        sqlx::query(r#"
            INSERT OR REPLACE INTO agent_sessions 
            (id, agent_id, name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        "#)
        .bind(&session.id)
        .bind(&session.agent_id)
        .bind(&session.name)
        .bind(&session.created_at)
        .bind(&session.updated_at)
        .execute(self.db.pool())
        .await?;
        Ok(())
    }

    pub async fn delete_agent_session(&self, id: &str) -> Result<(), SqlxError> {
        sqlx::query("DELETE FROM agent_sessions WHERE id = ?")
            .bind(id)
            .execute(self.db.pool())
            .await?;
        Ok(())
    }

    // Messages
    pub async fn get_messages(&self, session_id: &str) -> Result<Vec<Message>, SqlxError> {
        let rows = sqlx::query("SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC")
            .bind(session_id)
            .fetch_all(self.db.pool())
            .await?;

        let mut messages = Vec::new();
        for row in rows {
            messages.push(Message {
                id: row.get("id"),
                session_id: row.get("session_id"),
                content: row.get("content"),
                role: row.get("role"),
                timestamp: row.get("timestamp"),
                streaming: row.get("streaming"),
                canceled: row.get("canceled"),
                reasoning_content: row.get("reasoning_content"),
                reasoning_collapsed: row.get("reasoning_collapsed"),
                generation_start_time: row.get("generation_start_time"),
                generation_end_time: row.get("generation_end_time"),
                generation_duration: row.get("generation_duration"),
            });
        }
        Ok(messages)
    }

    pub async fn save_message(&self, message: &Message) -> Result<(), SqlxError> {
        sqlx::query(r#"
            INSERT OR REPLACE INTO messages 
            (id, session_id, content, role, timestamp, streaming, canceled, reasoning_content, 
             reasoning_collapsed, generation_start_time, generation_end_time, generation_duration)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#)
        .bind(&message.id)
        .bind(&message.session_id)
        .bind(&message.content)
        .bind(&message.role)
        .bind(&message.timestamp)
        .bind(&message.streaming)
        .bind(&message.canceled)
        .bind(&message.reasoning_content)
        .bind(&message.reasoning_collapsed)
        .bind(&message.generation_start_time)
        .bind(&message.generation_end_time)
        .bind(&message.generation_duration)
        .execute(self.db.pool())
        .await?;
        Ok(())
    }

    pub async fn delete_message(&self, id: &str) -> Result<(), SqlxError> {
        sqlx::query("DELETE FROM messages WHERE id = ?")
            .bind(id)
            .execute(self.db.pool())
            .await?;
        Ok(())
    }

    // Scenes
    pub async fn get_scenes(&self) -> Result<Vec<Scene>, SqlxError> {
        let rows = sqlx::query("SELECT * FROM scenes ORDER BY created_at ASC")
            .fetch_all(self.db.pool())
            .await?;

        let mut scenes = Vec::new();
        for row in rows {
            scenes.push(Scene {
                id: row.get("id"),
                name: row.get("name"),
                description: row.get("description"),
                scenario_prompt: row.get("scenario_prompt"),
                participants: row.get("participants"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            });
        }
        Ok(scenes)
    }

    pub async fn save_scene(&self, scene: &Scene) -> Result<(), SqlxError> {
        sqlx::query(r#"
            INSERT OR REPLACE INTO scenes 
            (id, name, description, scenario_prompt, participants, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        "#)
        .bind(&scene.id)
        .bind(&scene.name)
        .bind(&scene.description)
        .bind(&scene.scenario_prompt)
        .bind(&scene.participants)
        .bind(&scene.created_at)
        .bind(&scene.updated_at)
        .execute(self.db.pool())
        .await?;
        Ok(())
    }

    pub async fn delete_scene(&self, id: &str) -> Result<(), SqlxError> {
        sqlx::query("DELETE FROM scenes WHERE id = ?")
            .bind(id)
            .execute(self.db.pool())
            .await?;
        Ok(())
    }

    // Scene Sessions
    pub async fn get_scene_sessions(&self) -> Result<Vec<SceneSession>, SqlxError> {
        let rows = sqlx::query("SELECT * FROM scene_sessions ORDER BY updated_at DESC")
            .fetch_all(self.db.pool())
            .await?;

        let mut sessions = Vec::new();
        for row in rows {
            sessions.push(SceneSession {
                id: row.get("id"),
                scene_id: row.get("scene_id"),
                name: row.get("name"),
                is_active: row.get("is_active"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            });
        }
        Ok(sessions)
    }

    pub async fn save_scene_session(&self, session: &SceneSession) -> Result<(), SqlxError> {
        sqlx::query(r#"
            INSERT OR REPLACE INTO scene_sessions 
            (id, scene_id, name, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        "#)
        .bind(&session.id)
        .bind(&session.scene_id)
        .bind(&session.name)
        .bind(&session.is_active)
        .bind(&session.created_at)
        .bind(&session.updated_at)
        .execute(self.db.pool())
        .await?;
        Ok(())
    }

    pub async fn delete_scene_session(&self, id: &str) -> Result<(), SqlxError> {
        sqlx::query("DELETE FROM scene_sessions WHERE id = ?")
            .bind(id)
            .execute(self.db.pool())
            .await?;
        Ok(())
    }

    // Scene Messages
    pub async fn get_scene_messages(&self, session_id: &str) -> Result<Vec<SceneMessage>, SqlxError> {
        let rows = sqlx::query("SELECT * FROM scene_messages WHERE session_id = ? ORDER BY timestamp ASC")
            .bind(session_id)
            .fetch_all(self.db.pool())
            .await?;

        let mut messages = Vec::new();
        for row in rows {
            messages.push(SceneMessage {
                id: row.get("id"),
                session_id: row.get("session_id"),
                participant_id: row.get("participant_id"),
                agent_id: row.get("agent_id"),
                role: row.get("role"),
                content: row.get("content"),
                timestamp: row.get("timestamp"),
                metadata: row.get("metadata"),
            });
        }
        Ok(messages)
    }

    pub async fn save_scene_message(&self, message: &SceneMessage) -> Result<(), SqlxError> {
        sqlx::query(r#"
            INSERT OR REPLACE INTO scene_messages 
            (id, session_id, participant_id, agent_id, role, content, timestamp, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#)
        .bind(&message.id)
        .bind(&message.session_id)
        .bind(&message.participant_id)
        .bind(&message.agent_id)
        .bind(&message.role)
        .bind(&message.content)
        .bind(&message.timestamp)
        .bind(&message.metadata)
        .execute(self.db.pool())
        .await?;
        Ok(())
    }

    // MCP Server Configs
    pub async fn get_mcp_server_configs(&self) -> Result<Vec<MCPServerConfig>, SqlxError> {
        let rows = sqlx::query("SELECT * FROM mcp_server_configs ORDER BY created_at ASC")
            .fetch_all(self.db.pool())
            .await?;

        let mut configs = Vec::new();
        for row in rows {
            configs.push(MCPServerConfig {
                id: row.get("id"),
                name: row.get("name"),
                description: row.get("description"),
                enabled: row.get("enabled"),
                server_type: row.get("server_type"),
                server_class: row.get("server_class"),
                command: row.get("command"),
                args: row.get("args"),
                env: row.get("env"),
                capabilities: row.get("capabilities"),
                permissions: row.get("permissions"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            });
        }
        Ok(configs)
    }

    pub async fn save_mcp_server_config(&self, config: &MCPServerConfig) -> Result<(), SqlxError> {
        sqlx::query(r#"
            INSERT OR REPLACE INTO mcp_server_configs 
            (id, name, description, enabled, server_type, server_class, command, args, env, 
             capabilities, permissions, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#)
        .bind(&config.id)
        .bind(&config.name)
        .bind(&config.description)
        .bind(&config.enabled)
        .bind(&config.server_type)
        .bind(&config.server_class)
        .bind(&config.command)
        .bind(&config.args)
        .bind(&config.env)
        .bind(&config.capabilities)
        .bind(&config.permissions)
        .bind(&config.created_at)
        .bind(&config.updated_at)
        .execute(self.db.pool())
        .await?;
        Ok(())
    }

    pub async fn delete_mcp_server_config(&self, id: &str) -> Result<(), SqlxError> {
        sqlx::query("DELETE FROM mcp_server_configs WHERE id = ?")
            .bind(id)
            .execute(self.db.pool())
            .await?;
        Ok(())
    }

    // App Settings
    pub async fn get_setting(&self, key: &str) -> Result<Option<String>, SqlxError> {
        let row = sqlx::query("SELECT value FROM app_settings WHERE key = ?")
            .bind(key)
            .fetch_optional(self.db.pool())
            .await?;

        if let Some(row) = row {
            Ok(Some(row.get("value")))
        } else {
            Ok(None)
        }
    }

    pub async fn save_setting(&self, key: &str, value: &str) -> Result<(), SqlxError> {
        sqlx::query(r#"
            INSERT OR REPLACE INTO app_settings (key, value, updated_at)
            VALUES (?, ?, ?)
        "#)
        .bind(key)
        .bind(value)
        .bind(Utc::now())
        .execute(self.db.pool())
        .await?;
        Ok(())
    }

    pub async fn delete_setting(&self, key: &str) -> Result<(), SqlxError> {
        sqlx::query("DELETE FROM app_settings WHERE key = ?")
            .bind(key)
            .execute(self.db.pool())
            .await?;
        Ok(())
    }

    // Bulk operations for chat history
    pub async fn get_chat_history(&self) -> Result<Vec<Message>, SqlxError> {
        // 获取主聊天会话的消息（使用特殊的session_id）
        let rows = sqlx::query("SELECT * FROM messages WHERE session_id = 'main_chat' ORDER BY timestamp ASC")
            .fetch_all(self.db.pool())
            .await?;

        let mut messages = Vec::new();
        for row in rows {
            messages.push(Message {
                id: row.get("id"),
                session_id: row.get("session_id"),
                content: row.get("content"),
                role: row.get("role"),
                timestamp: row.get("timestamp"),
                streaming: row.get("streaming"),
                canceled: row.get("canceled"),
                reasoning_content: row.get("reasoning_content"),
                reasoning_collapsed: row.get("reasoning_collapsed"),
                generation_start_time: row.get("generation_start_time"),
                generation_end_time: row.get("generation_end_time"),
                generation_duration: row.get("generation_duration"),
            });
        }
        Ok(messages)
    }

    pub async fn save_chat_history(&self, messages: &[Message]) -> Result<(), SqlxError> {
        // 首先清空主聊天历史
        sqlx::query("DELETE FROM messages WHERE session_id = 'main_chat'")
            .execute(self.db.pool())
            .await?;
        
        // 批量插入新消息
        for message in messages {
            sqlx::query(r#"
                INSERT OR REPLACE INTO messages 
                (id, session_id, content, role, timestamp, streaming, canceled, reasoning_content, 
                 reasoning_collapsed, generation_start_time, generation_end_time, generation_duration)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#)
            .bind(&message.id)
            .bind(&message.session_id)
            .bind(&message.content)
            .bind(&message.role)
            .bind(&message.timestamp)
            .bind(&message.streaming)
            .bind(&message.canceled)
            .bind(&message.reasoning_content)
            .bind(&message.reasoning_collapsed)
            .bind(&message.generation_start_time)
            .bind(&message.generation_end_time)
            .bind(&message.generation_duration)
            .execute(self.db.pool())
            .await?;
        }
        Ok(())
    }

    pub async fn clear_chat_history(&self) -> Result<(), SqlxError> {
        sqlx::query("DELETE FROM messages WHERE session_id = 'main_chat'")
            .execute(self.db.pool())
            .await?;
        Ok(())
    }
} 