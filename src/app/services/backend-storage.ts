import { invoke } from '@tauri-apps/api/core';
import { AIProvider, ProxySettings, Message, Agent, Scene, MCPServerConfig } from '../types';
import { logService } from './log';

/**
 * 后端存储服务类
 * 使用Tauri命令与Rust后端的SQLite数据库交互
 */
class BackendStorageService {
  
  /**
   * 获取AI提供商列表
   */
  async getProviders(): Promise<AIProvider[]> {
    try {
      const result = await invoke<string>('storage_get_providers');
      return JSON.parse(result);
    } catch (error) {
      logService.error('获取AI提供商失败:', error);
      return [];
    }
  }

  /**
   * 保存AI提供商列表
   */
  async saveProviders(providers: AIProvider[]): Promise<void> {
    try {
      // 逐个保存提供商
      for (const provider of providers) {
        await invoke('storage_save_provider', { 
          providerJson: JSON.stringify({
            ...provider,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            models: JSON.stringify(provider.models || []),
            custom_config: provider.customConfig ? JSON.stringify(provider.customConfig) : null,
            auto_fetch_config: provider.autoFetchConfig ? JSON.stringify(provider.autoFetchConfig) : null,
          })
        });
      }
    } catch (error) {
      logService.error('保存AI提供商失败:', error);
    }
  }

  /**
   * 获取代理设置
   */
  async getProxySettings(): Promise<ProxySettings> {
    try {
      const result = await invoke<string | null>('storage_get_proxy_settings');
      if (result) {
        const settings = JSON.parse(result);
        return {
          enabled: settings.enabled,
          type: settings.proxy_type,
          host: settings.host,
          port: settings.port,
          requiresAuth: settings.requires_auth,
          username: settings.username,
          password: settings.password,
        };
      }
      return {
        enabled: false,
        type: 'http',
        host: '',
        port: 0,
        requiresAuth: false,
        username: '',
        password: ''
      };
    } catch (error) {
      logService.error('获取代理设置失败:', error);
      return {
        enabled: false,
        type: 'http',
        host: '',
        port: 0,
        requiresAuth: false,
        username: '',
        password: ''
      };
    }
  }

  /**
   * 保存代理设置
   */
  async saveProxySettings(settings: ProxySettings): Promise<void> {
    try {
      await invoke('storage_save_proxy_settings', {
        settingsJson: JSON.stringify({
          id: 1, // 使用固定ID，因为只有一个代理配置
          enabled: settings.enabled,
          proxy_type: settings.type,
          host: settings.host,
          port: settings.port,
          requires_auth: settings.requiresAuth,
          username: settings.username,
          password: settings.password,
          updated_at: new Date().toISOString(),
        })
      });
    } catch (error) {
      logService.error('保存代理设置失败:', error);
    }
  }

  /**
   * 获取应用设置
   */
  async getSetting(key: string): Promise<string | null> {
    try {
      return await invoke<string | null>('storage_get_setting', { key });
    } catch (error) {
      logService.error('获取应用设置失败:', error);
      return null;
    }
  }

  /**
   * 保存应用设置
   */
  async saveSetting(key: string, value: string): Promise<void> {
    try {
      await invoke('storage_save_setting', { key, value });
    } catch (error) {
      logService.error('保存应用设置失败:', error);
    }
  }

  /**
   * 获取聊天历史
   */
  async getChatHistory(): Promise<Message[]> {
    try {
      const result = await invoke<string>('storage_get_chat_history');
      const messages = JSON.parse(result) as Array<{
        id: string;
        content: string;
        role: 'user' | 'assistant';
        timestamp: string;
        streaming?: boolean;
        canceled?: boolean;
        reasoning_content?: string;
        reasoning_collapsed?: boolean;
        generation_start_time?: string;
        generation_end_time?: string;
        generation_duration?: number;
      }>;
      // 转换数据格式
      return messages.map((msg) => ({
        id: msg.id,
        content: msg.content,
        role: msg.role as 'user' | 'assistant',
        timestamp: new Date(msg.timestamp),
        streaming: msg.streaming,
        canceled: msg.canceled,
        reasoningContent: msg.reasoning_content,
        reasoningCollapsed: msg.reasoning_collapsed,
        generationStartTime: msg.generation_start_time ? new Date(msg.generation_start_time) : undefined,
        generationEndTime: msg.generation_end_time ? new Date(msg.generation_end_time) : undefined,
        generationDuration: msg.generation_duration,
      }));
    } catch (error) {
      logService.error('获取聊天历史失败:', error);
      return [];
    }
  }

  /**
   * 保存聊天历史
   */
  async saveChatHistory(messages: Message[]): Promise<void> {
    try {
      const dbMessages = messages.map(msg => ({
        id: msg.id,
        session_id: 'main_chat',
        content: msg.content,
        role: msg.role,
        timestamp: msg.timestamp.toISOString(),
        streaming: msg.streaming,
        canceled: msg.canceled,
        reasoning_content: msg.reasoningContent,
        reasoning_collapsed: msg.reasoningCollapsed,
        generation_start_time: msg.generationStartTime?.toISOString(),
        generation_end_time: msg.generationEndTime?.toISOString(),
        generation_duration: msg.generationDuration,
      }));
      
      await invoke('storage_save_chat_history', {
        messagesJson: JSON.stringify(dbMessages)
      });
    } catch (error) {
      logService.error('保存聊天历史失败:', error);
    }
  }

  /**
   * 清空聊天历史
   */
  async clearChatHistory(): Promise<void> {
    try {
      await invoke('storage_clear_chat_history');
    } catch (error) {
      logService.error('清空聊天历史失败:', error);
    }
  }

  /**
   * 获取当前选择的AI提供商ID
   */
  async getSelectedProviderId(): Promise<string> {
    const result = await this.getSetting('selectedProviderId');
    return result || 'default';
  }

  /**
   * 保存当前选择的AI提供商ID
   */
  async saveSelectedProviderId(id: string): Promise<void> {
    await this.saveSetting('selectedProviderId', id);
  }

  /**
   * 获取当前选择的模型ID
   */
  async getSelectedModelId(): Promise<string> {
    const result = await this.getSetting('selectedModelId');
    return result || '';
  }

  /**
   * 保存当前选择的模型ID
   */
  async saveSelectedModelId(id: string): Promise<void> {
    await this.saveSetting('selectedModelId', id);
  }

  /**
   * 获取流式模式设置
   */
  async getStreamMode(): Promise<boolean> {
    const result = await this.getSetting('streamMode');
    return result ? result === 'true' : true;
  }

  /**
   * 保存流式模式设置
   */
  async saveStreamMode(enabled: boolean): Promise<void> {
    await this.saveSetting('streamMode', String(enabled));
  }

  /**
   * 获取温度设置
   */
  async getTemperature(): Promise<number> {
    const result = await this.getSetting('temperature');
    return result ? parseFloat(result) : 0;
  }

  /**
   * 保存温度设置
   */
  async saveTemperature(temperature: number): Promise<void> {
    await this.saveSetting('temperature', temperature.toString());
  }

  // Agent相关方法
  /**
   * 获取所有Agent列表
   */
  async getAgents(): Promise<Agent[]> {
    try {
      const result = await invoke<string>('storage_get_agents');
      return JSON.parse(result);
    } catch (error) {
      logService.error('获取Agent列表失败:', error);
      return [];
    }
  }

  /**
   * 保存Agent配置
   */
  async saveAgent(agent: Agent): Promise<void> {
    try {
      await invoke('storage_save_agent', { 
        agentJson: JSON.stringify({
          ...agent,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          settings: agent.settings ? JSON.stringify(agent.settings) : null,
        })
      });
    } catch (error) {
      logService.error('保存Agent失败:', error);
    }
  }

  /**
   * 删除Agent
   */
  async deleteAgent(agentId: string): Promise<void> {
    try {
      await invoke('storage_delete_agent', { id: agentId });
    } catch (error) {
      logService.error('删除Agent失败:', error);
    }
  }

  // Scene相关方法
  /**
   * 获取所有场景列表
   */
  async getScenes(): Promise<Scene[]> {
    try {
      const result = await invoke<string>('storage_get_scenes');
      return JSON.parse(result);
    } catch (error) {
      logService.error('获取场景列表失败:', error);
      return [];
    }
  }

  /**
   * 保存场景配置
   */
  async saveScene(scene: Scene): Promise<void> {
    try {
      await invoke('storage_save_scene', { 
        sceneJson: JSON.stringify({
          ...scene,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          participants: scene.participants ? JSON.stringify(scene.participants) : null,
        })
      });
    } catch (error) {
      logService.error('保存场景失败:', error);
    }
  }

  /**
   * 删除场景
   */
  async deleteScene(sceneId: string): Promise<void> {
    try {
      await invoke('storage_delete_scene', { id: sceneId });
    } catch (error) {
      logService.error('删除场景失败:', error);
    }
  }

  // MCP服务器配置相关方法
  /**
   * 获取MCP服务器配置列表
   */
  async getMCPServerConfigs(): Promise<MCPServerConfig[]> {
    try {
      const result = await invoke<string>('storage_get_mcp_configs');
      return JSON.parse(result);
    } catch (error) {
      logService.error('获取MCP服务器配置失败:', error);
      return [];
    }
  }

  /**
   * 保存MCP服务器配置
   */
  async saveMCPServerConfig(config: MCPServerConfig): Promise<void> {
    try {
      await invoke('storage_save_mcp_config', { 
        configJson: JSON.stringify({
          ...config,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          args: config.args ? JSON.stringify(config.args) : null,
          env: config.env ? JSON.stringify(config.env) : null,
          capabilities: config.capabilities ? JSON.stringify(config.capabilities) : null,
          permissions: config.permissions ? JSON.stringify(config.permissions) : null,
        })
      });
    } catch (error) {
      logService.error('保存MCP服务器配置失败:', error);
    }
  }

  /**
   * 删除MCP服务器配置
   */
  async deleteMCPServerConfig(configId: string): Promise<void> {
    try {
      await invoke('storage_delete_mcp_config', { id: configId });
    } catch (error) {
      logService.error('删除MCP服务器配置失败:', error);
    }
  }
}

// 导出单例
export const backendStorageService = new BackendStorageService(); 