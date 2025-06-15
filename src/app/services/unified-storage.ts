import { backendStorageService } from './backend-storage';
import { AIProvider, ProxySettings, Message, Agent, AgentSession, Scene, SceneSession, MCPServerConfig } from '../types';
import { logService } from './log';

// 后端数据库结构类型定义（snake_case）
interface DBAgent {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  provider_id: string;
  model_id: string;
  keep_history: boolean;
  max_history_messages: number | null;
  icon: string | null;
  is_stream_mode: boolean | null;
  temperature: number | null;
  settings: string | null;
  created_at: string;
  updated_at: string;
}

interface DBScene {
  id: string;
  name: string;
  description: string;
  scenario_prompt: string;
  participants: string | null;
  created_at: string;
  updated_at: string;
}

interface DBMCPServerConfig {
  id: string;
  name: string;
  server_type: string;
  config: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * 统一存储服务
 * 使用后端SQLite数据库存储
 */
class UnifiedStorageService {

  /**
   * 获取AI提供商列表
   */
  async getProviders(): Promise<AIProvider[]> {
    try {
      return await backendStorageService.getProviders();
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
      await backendStorageService.saveProviders(providers);
    } catch (error) {
      logService.error('保存AI提供商失败:', error);
    }
  }

  /**
   * 获取代理设置
   */
  async getProxySettings(): Promise<ProxySettings> {
    try {
      return await backendStorageService.getProxySettings();
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
      await backendStorageService.saveProxySettings(settings);
    } catch (error) {
      logService.error('保存代理设置失败:', error);
    }
  }

  /**
   * 获取当前选择的AI提供商ID
   */
  async getSelectedProviderId(): Promise<string> {
    try {
      return await backendStorageService.getSelectedProviderId();
    } catch (error) {
      logService.error('获取选中提供商ID失败:', error);
      return 'default';
    }
  }

  /**
   * 保存当前选择的AI提供商ID
   */
  async saveSelectedProviderId(id: string): Promise<void> {
    try {
      await backendStorageService.saveSelectedProviderId(id);
    } catch (error) {
      logService.error('保存选中提供商ID失败:', error);
    }
  }

  /**
   * 获取当前选择的模型ID
   */
  async getSelectedModelId(): Promise<string> {
    try {
      return await backendStorageService.getSelectedModelId();
    } catch (error) {
      logService.error('获取选中模型ID失败:', error);
      return '';
    }
  }

  /**
   * 保存当前选择的模型ID
   */
  async saveSelectedModelId(id: string): Promise<void> {
    try {
      await backendStorageService.saveSelectedModelId(id);
    } catch (error) {
      logService.error('保存选中模型ID失败:', error);
    }
  }

  /**
   * 获取流式模式设置
   */
  async getStreamMode(): Promise<boolean> {
    try {
      return await backendStorageService.getStreamMode();
    } catch (error) {
      logService.error('获取流式模式设置失败:', error);
      return true;
    }
  }

  /**
   * 保存流式模式设置
   */
  async saveStreamMode(enabled: boolean): Promise<void> {
    try {
      await backendStorageService.saveStreamMode(enabled);
    } catch (error) {
      logService.error('保存流式模式设置失败:', error);
    }
  }

  /**
   * 获取温度设置
   */
  async getTemperature(): Promise<number> {
    try {
      return await backendStorageService.getTemperature();
    } catch (error) {
      logService.error('获取温度设置失败:', error);
      return 0.7;
    }
  }

  /**
   * 保存温度设置
   */
  async saveTemperature(temperature: number): Promise<void> {
    try {
      await backendStorageService.saveTemperature(temperature);
    } catch (error) {
      logService.error('保存温度设置失败:', error);
    }
  }

  /**
   * 获取聊天历史
   */
  async getChatHistory(): Promise<Message[]> {
    try {
      return await backendStorageService.getChatHistory();
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
      await backendStorageService.saveChatHistory(messages);
    } catch (error) {
      logService.error('保存聊天历史失败:', error);
    }
  }

  /**
   * 清空聊天历史
   */
  async clearChatHistory(): Promise<void> {
    try {
      await backendStorageService.clearChatHistory();
    } catch (error) {
      logService.error('清空聊天历史失败:', error);
    }
  }

  /**
   * 获取应用设置
   */
  async getSetting(key: string): Promise<string | null> {
    try {
      return await backendStorageService.getSetting(key);
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
      await backendStorageService.saveSetting(key, value);
    } catch (error) {
      logService.error('保存应用设置失败:', error);
    }
  }

  /**
   * 获取Agent配置
   */
  async getAgent(_agentId: string): Promise<Agent | null> {
    void _agentId;
    try {
      // 暂时返回null，需要后端实现
      logService.warn('getAgent方法暂未实现');
      return null;
    } catch (error) {
      logService.error('获取Agent失败:', error);
      return null;
    }
  }

  /**
   * 获取场景配置
   */
  async getScene(_sceneId: string): Promise<Scene | null> {
    void _sceneId;
    try {
      // 暂时返回null，需要后端实现
      logService.warn('getScene方法暂未实现');
      return null;
    } catch (error) {
      logService.error('获取场景失败:', error);
      return null;
    }
  }

  /**
   * 获取场景会话
   */
  async getSceneSession(_sessionId: string): Promise<SceneSession | null> {
    void _sessionId;
    try {
      // 暂时返回null，需要后端实现
      logService.warn('getSceneSession方法暂未实现');
      return null;
    } catch (error) {
      logService.error('获取场景会话失败:', error);
      return null;
    }
  }

  /**
   * 保存场景会话
   */
  async saveSceneSession(_session: SceneSession): Promise<void> {
    void _session;
    try {
      // 暂时不执行，需要后端实现
      logService.warn('saveSceneSession方法暂未实现');
    } catch (error) {
      logService.error('保存场景会话失败:', error);
    }
  }

  /**
   * 获取MCP服务器配置列表
   */
  async getMCPServerConfigs(): Promise<MCPServerConfig[]> {
    try {
      const configs = await backendStorageService.getMCPServerConfigs();
      // 转换为前端MCP服务器配置类型格式
      return configs.map((config: unknown) => {
        const c = config as DBMCPServerConfig;
          const parsedConfig = c.config ? JSON.parse(c.config) as Record<string, unknown> : {};
          return {
            id: c.id,
            name: c.name,
            description: (parsedConfig.description as string) || '',
            enabled: c.enabled,
            type: c.server_type as 'builtin' | 'external',
            serverClass: parsedConfig.serverClass as string | undefined,
            command: parsedConfig.command as string | undefined,
            args: parsedConfig.args as string[] | undefined,
            env: parsedConfig.env as Record<string, string> | undefined,
            capabilities: (parsedConfig.capabilities as MCPServerConfig['capabilities']) || { tools: false, resources: false, prompts: false },
            permissions: (parsedConfig.permissions as MCPServerConfig['permissions']) || { allowToolExecution: false, allowResourceAccess: false, allowedDomains: [] },
          };
      });
    } catch (error) {
      logService.error('获取MCP服务器配置列表失败:', error);
      return [];
    }
  }

  /**
   * 保存MCP服务器配置列表
   */
  async saveMCPServerConfigs(configs: MCPServerConfig[]): Promise<void> {
    try {
      // backend-storage.ts期望接收前端的camelCase类型，会在内部转换
      for (const config of configs) {
        await backendStorageService.saveMCPServerConfig(config);
      }
    } catch (error) {
      logService.error('保存MCP服务器配置列表失败:', error);
    }
  }

  /**
   * 获取所有Agent列表
   */
  async getAgents(): Promise<Agent[]> {
    try {
      const agents = await backendStorageService.getAgents();
      // 转换为前端Agent类型格式
      return agents.map((agent: unknown) => {
        const a = agent as DBAgent;
        return {
          id: a.id,
          name: a.name,
          description: a.description,
          systemPrompt: a.system_prompt,
          providerId: a.provider_id,
          modelId: a.model_id,
          keepHistory: a.keep_history,
          maxHistoryMessages: a.max_history_messages ?? undefined,
          icon: a.icon ?? undefined,
          isStreamMode: a.is_stream_mode ?? undefined,
          temperature: a.temperature ?? undefined,
          settings: a.settings ? JSON.parse(a.settings) as Agent['settings'] : undefined,
          createdAt: new Date(a.created_at),
          updatedAt: new Date(a.updated_at),
        };
      });
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
      // backend-storage.ts期望接收前端的camelCase类型，会在内部转换为snake_case
      await backendStorageService.saveAgent(agent);
    } catch (error) {
      logService.error('保存Agent失败:', error);
    }
  }

  /**
   * 删除Agent
   */
  async deleteAgent(agentId: string): Promise<void> {
    try {
      await backendStorageService.deleteAgent(agentId);
    } catch (error) {
      logService.error('删除Agent失败:', error);
    }
  }

  /**
   * 根据AgentId获取Agent会话列表
   */
  async getAgentSessionsByAgentId(_agentId: string): Promise<AgentSession[]> {
    void _agentId;
    try {
      // 暂时返回空数组，需要后端实现
      logService.warn('getAgentSessionsByAgentId方法暂未实现');
      return [];
    } catch (error) {
      logService.error('获取Agent会话列表失败:', error);
      return [];
    }
  }

  /**
   * 获取Agent会话
   */
  async getAgentSession(_sessionId: string): Promise<AgentSession | null> {
    void _sessionId;
    try {
      // 暂时返回null，需要后端实现
      logService.warn('getAgentSession方法暂未实现');
      return null;
    } catch (error) {
      logService.error('获取Agent会话失败:', error);
      return null;
    }
  }

  /**
   * 保存Agent会话
   */
  async saveAgentSession(_session: AgentSession): Promise<void> {
    void _session;
    try {
      // 暂时不执行，需要后端实现
      logService.warn('saveAgentSession方法暂未实现');
    } catch (error) {
      logService.error('保存Agent会话失败:', error);
    }
  }

  /**
   * 删除Agent会话
   */
  async deleteAgentSession(_sessionId: string): Promise<void> {
    void _sessionId;
    try {
      // 暂时不执行，需要后端实现
      logService.warn('deleteAgentSession方法暂未实现');
    } catch (error) {
      logService.error('删除Agent会话失败:', error);
    }
  }

  /**
   * 获取所有场景列表
   */
  async getScenes(): Promise<Scene[]> {
    try {
      const scenes = await backendStorageService.getScenes();
      // 转换为前端Scene类型格式
      return scenes.map((scene: unknown) => {
        const s = scene as DBScene;
        return {
          id: s.id,
          name: s.name,
          description: s.description,
          scenarioPrompt: s.scenario_prompt,
          participants: s.participants ? JSON.parse(s.participants) : [],
          createdAt: new Date(s.created_at),
          updatedAt: new Date(s.updated_at),
        };
      });
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
      // backend-storage.ts期望接收前端的camelCase类型，会在内部转换
      await backendStorageService.saveScene(scene);
    } catch (error) {
      logService.error('保存场景失败:', error);
    }
  }

  /**
   * 删除场景
   */
  async deleteScene(sceneId: string): Promise<void> {
    try {
      await backendStorageService.deleteScene(sceneId);
    } catch (error) {
      logService.error('删除场景失败:', error);
    }
  }

  /**
   * 根据SceneId获取场景会话列表
   */
  async getSceneSessionsBySceneId(_sceneId: string): Promise<unknown[]> {
    void _sceneId;
    try {
      // 暂时返回空数组，需要后端实现
      logService.warn('getSceneSessionsBySceneId方法暂未实现');
      return [];
    } catch (error) {
      logService.error('获取场景会话列表失败:', error);
      return [];
    }
  }

  /**
   * 删除场景会话
   */
  async deleteSceneSession(_sessionId: string): Promise<void> {
    void _sessionId;
    try {
      // 暂时不执行，需要后端实现
      logService.warn('deleteSceneSession方法暂未实现');
    } catch (error) {
      logService.error('删除场景会话失败:', error);
    }
  }
}

export const unifiedStorageService = new UnifiedStorageService(); 