import { AIProvider, ProxySettings, Agent, AgentSession, Scene, SceneSession } from '../types';
import { logService } from './log';

/**
 * 检查是否在浏览器环境中
 */
const isBrowser = typeof window !== 'undefined';

/**
 * 存储服务类
 * 用于统一管理本地存储操作
 */
class StorageService {
  private readonly providersKey = 'aiProviders';
  private readonly proxyKey = 'proxySettings';
  private readonly agentsKey = 'aiAgents';
  private readonly agentSessionsKey = 'aiAgentSessions';
  private readonly scenesKey = 'aiScenes';
  private readonly sceneSessionsKey = 'aiSceneSessions';

  /**
   * 获取AI提供商列表
   */
  getProviders(): AIProvider[] {
    try {
      if (!isBrowser) return [];
      
      const providers = localStorage.getItem(this.providersKey);
      return providers ? JSON.parse(providers) : [];
    } catch (error) {
      logService.error('获取AI提供商失败:', error);
      return [];
    }
  }

  /**
   * 保存AI提供商列表
   */
  saveProviders(providers: AIProvider[]): void {
    try {
      if (!isBrowser) return;
      
      localStorage.setItem(this.providersKey, JSON.stringify(providers));
    } catch (error) {
      logService.error('保存AI提供商失败:', error);
    }
  }

  /**
   * 获取代理设置
   */
  getProxySettings(): ProxySettings {
    try {
      if (!isBrowser) {
        return {
          enabled: false,
          host: '',
          port: '',
          requiresAuth: false,
          username: '',
          password: ''
        };
      }
      
      const settings = localStorage.getItem(this.proxyKey);
      return settings 
        ? JSON.parse(settings) 
        : {
            enabled: false,
            host: '',
            port: '',
            requiresAuth: false,
            username: '',
            password: ''
          };
    } catch (error) {
      logService.error('获取代理设置失败:', error);
      return {
        enabled: false,
        host: '',
        port: '',
        requiresAuth: false,
        username: '',
        password: ''
      };
    }
  }

  /**
   * 保存代理设置
   */
  saveProxySettings(settings: ProxySettings): void {
    try {
      if (!isBrowser) return;
      
      localStorage.setItem(this.proxyKey, JSON.stringify(settings));
    } catch (error) {
      logService.error('保存代理设置失败:', error);
    }
  }

  /**
   * 获取当前选择的AI提供商ID
   */
  getSelectedProviderId(): string {
    try {
      if (!isBrowser) return 'default';
      
      return localStorage.getItem('selectedProviderId') || 'default';
    } catch (error) {
      logService.error('获取选中提供商ID失败:', error);
      return 'default';
    }
  }

  /**
   * 保存当前选择的AI提供商ID
   */
  saveSelectedProviderId(id: string): void {
    try {
      if (!isBrowser) return;
      
      localStorage.setItem('selectedProviderId', id);
    } catch (error) {
      logService.error('保存选中提供商ID失败:', error);
    }
  }

  /**
   * 获取当前选择的模型ID
   */
  getSelectedModelId(): string {
    try {
      if (!isBrowser) return '';
      
      return localStorage.getItem('selectedModelId') || '';
    } catch (error) {
      logService.error('获取选中模型ID失败:', error);
      return '';
    }
  }

  /**
   * 保存当前选择的模型ID
   */
  saveSelectedModelId(id: string): void {
    try {
      if (!isBrowser) return;
      
      localStorage.setItem('selectedModelId', id);
    } catch (error) {
      logService.error('保存选中模型ID失败:', error);
    }
  }

  /**
   * 获取所有AI Agent
   */
  getAgents(): Agent[] {
    try {
      if (!isBrowser) return [];
      
      const agents = localStorage.getItem(this.agentsKey);
      if (!agents) return [];
      
      // 确保日期字段正确解析
      return JSON.parse(agents, (key, value) => {
        if (key === 'createdAt' || key === 'updatedAt') {
          return new Date(value);
        }
        return value;
      });
    } catch (error) {
      logService.error('获取AI Agent失败:', error);
      return [];
    }
  }

  /**
   * 保存所有AI Agent
   */
  saveAgents(agents: Agent[]): void {
    try {
      if (!isBrowser) return;
      
      localStorage.setItem(this.agentsKey, JSON.stringify(agents));
    } catch (error) {
      logService.error('保存AI Agent失败:', error);
    }
  }

  /**
   * 获取单个Agent
   */
  getAgent(id: string): Agent | null {
    try {
      const agents = this.getAgents();
      return agents.find(agent => agent.id === id) || null;
    } catch (error) {
      logService.error(`获取Agent ID ${id} 失败:`, error);
      return null;
    }
  }

  /**
   * 添加或更新Agent
   */
  saveAgent(agent: Agent): void {
    try {
      const agents = this.getAgents();
      const index = agents.findIndex(a => a.id === agent.id);
      
      if (index >= 0) {
        agents[index] = { ...agent, updatedAt: new Date() };
      } else {
        agents.push({ ...agent, createdAt: new Date(), updatedAt: new Date() });
      }
      
      this.saveAgents(agents);
      logService.info(`保存Agent: ${agent.name}`);
    } catch (error) {
      logService.error(`保存Agent ${agent.name} 失败:`, error);
    }
  }

  /**
   * 删除Agent
   */
  deleteAgent(id: string): void {
    try {
      const agents = this.getAgents();
      const updatedAgents = agents.filter(agent => agent.id !== id);
      this.saveAgents(updatedAgents);
      
      // 同时删除该Agent的所有会话
      this.deleteAgentSessions(id);
      
      logService.info(`删除Agent ID: ${id}`);
    } catch (error) {
      logService.error(`删除Agent ID ${id} 失败:`, error);
    }
  }

  /**
   * 获取所有Agent会话
   */
  getAgentSessions(): AgentSession[] {
    try {
      if (!isBrowser) return [];
      
      const sessions = localStorage.getItem(this.agentSessionsKey);
      if (!sessions) return [];
      
      // 确保日期字段和Message的timestamp正确解析
      return JSON.parse(sessions, (key, value) => {
        if (key === 'createdAt' || key === 'updatedAt' || key === 'timestamp') {
          return new Date(value);
        }
        return value;
      });
    } catch (error) {
      logService.error('获取Agent会话失败:', error);
      return [];
    }
  }

  /**
   * 保存所有Agent会话
   */
  saveAgentSessions(sessions: AgentSession[]): void {
    try {
      if (!isBrowser) return;
      
      localStorage.setItem(this.agentSessionsKey, JSON.stringify(sessions));
    } catch (error) {
      logService.error('保存Agent会话失败:', error);
    }
  }

  /**
   * 获取特定Agent的所有会话
   */
  getAgentSessionsByAgentId(agentId: string): AgentSession[] {
    try {
      const sessions = this.getAgentSessions();
      return sessions.filter(session => session.agentId === agentId);
    } catch (error) {
      logService.error(`获取Agent ID ${agentId} 的会话失败:`, error);
      return [];
    }
  }

  /**
   * 获取单个会话
   */
  getAgentSession(sessionId: string): AgentSession | null {
    try {
      const sessions = this.getAgentSessions();
      return sessions.find(session => session.id === sessionId) || null;
    } catch (error) {
      logService.error(`获取会话 ID ${sessionId} 失败:`, error);
      return null;
    }
  }

  /**
   * 添加或更新会话
   */
  saveAgentSession(session: AgentSession): void {
    try {
      const sessions = this.getAgentSessions();
      const index = sessions.findIndex(s => s.id === session.id);
      
      if (index >= 0) {
        sessions[index] = { ...session, updatedAt: new Date() };
      } else {
        sessions.push({ ...session, createdAt: new Date(), updatedAt: new Date() });
      }
      
      this.saveAgentSessions(sessions);
      logService.info(`保存会话: ${session.name}`);
    } catch (error) {
      logService.error(`保存会话 ${session.name} 失败:`, error);
    }
  }

  /**
   * 删除会话
   */
  deleteAgentSession(sessionId: string): void {
    try {
      const sessions = this.getAgentSessions();
      const updatedSessions = sessions.filter(session => session.id !== sessionId);
      this.saveAgentSessions(updatedSessions);
      logService.info(`删除会话 ID: ${sessionId}`);
    } catch (error) {
      logService.error(`删除会话 ID ${sessionId} 失败:`, error);
    }
  }

  /**
   * 删除Agent的所有会话
   */
  deleteAgentSessions(agentId: string): void {
    try {
      const allSessions = this.getAgentSessions();
      const updatedSessions = allSessions.filter(session => session.agentId !== agentId);
      this.saveAgentSessions(updatedSessions);
      
      logService.info(`删除Agent ID ${agentId} 的所有会话`);
    } catch (error) {
      logService.error(`删除Agent ID ${agentId} 的会话失败:`, error);
    }
  }

  /**
   * 获取所有场景
   */
  getScenes(): Scene[] {
    try {
      if (!isBrowser) return [];
      
      const scenes = localStorage.getItem(this.scenesKey);
      if (!scenes) return [];
      
      // 确保日期字段正确解析
      return JSON.parse(scenes, (key, value) => {
        if (key === 'createdAt' || key === 'updatedAt') {
          return new Date(value);
        }
        return value;
      });
    } catch (error) {
      logService.error('获取场景列表失败:', error);
      return [];
    }
  }

  /**
   * 保存所有场景
   */
  saveScenes(scenes: Scene[]): void {
    try {
      if (!isBrowser) return;
      
      localStorage.setItem(this.scenesKey, JSON.stringify(scenes));
    } catch (error) {
      logService.error('保存场景列表失败:', error);
    }
  }

  /**
   * 获取单个场景
   */
  getScene(id: string): Scene | null {
    try {
      const scenes = this.getScenes();
      return scenes.find(scene => scene.id === id) || null;
    } catch (error) {
      logService.error(`获取场景 ID ${id} 失败:`, error);
      return null;
    }
  }

  /**
   * 添加或更新场景
   */
  saveScene(scene: Scene): void {
    try {
      const scenes = this.getScenes();
      const index = scenes.findIndex(s => s.id === scene.id);
      
      if (index >= 0) {
        scenes[index] = { ...scene, updatedAt: new Date() };
      } else {
        scenes.push({ ...scene, createdAt: new Date(), updatedAt: new Date() });
      }
      
      this.saveScenes(scenes);
      logService.info(`保存场景: ${scene.name}`);
    } catch (error) {
      logService.error(`保存场景 ${scene.name} 失败:`, error);
    }
  }

  /**
   * 删除场景
   */
  deleteScene(id: string): void {
    try {
      const scenes = this.getScenes();
      const updatedScenes = scenes.filter(scene => scene.id !== id);
      this.saveScenes(updatedScenes);
      
      // 同时删除该场景的所有会话
      this.deleteSceneSessions(id);
      
      logService.info(`删除场景 ID: ${id}`);
    } catch (error) {
      logService.error(`删除场景 ID ${id} 失败:`, error);
    }
  }

  /**
   * 获取所有场景会话
   */
  getSceneSessions(): SceneSession[] {
    try {
      if (!isBrowser) return [];
      
      const sessions = localStorage.getItem(this.sceneSessionsKey);
      if (!sessions) return [];
      
      // 确保日期字段正确解析
      return JSON.parse(sessions, (key, value) => {
        if (key === 'createdAt' || key === 'updatedAt') {
          return new Date(value);
        }
        return value;
      });
    } catch (error) {
      logService.error('获取场景会话失败:', error);
      return [];
    }
  }

  /**
   * 保存所有场景会话
   */
  saveSceneSessions(sessions: SceneSession[]): void {
    try {
      if (!isBrowser) return;
      
      localStorage.setItem(this.sceneSessionsKey, JSON.stringify(sessions));
    } catch (error) {
      logService.error('保存场景会话失败:', error);
    }
  }

  /**
   * 获取指定场景的所有会话
   */
  getSceneSessionsBySceneId(sceneId: string): SceneSession[] {
    try {
      const sessions = this.getSceneSessions();
      return sessions.filter(session => session.sceneId === sceneId);
    } catch (error) {
      logService.error(`获取场景 ID ${sceneId} 的会话失败:`, error);
      return [];
    }
  }

  /**
   * 获取单个场景会话
   */
  getSceneSession(sessionId: string): SceneSession | null {
    try {
      const sessions = this.getSceneSessions();
      return sessions.find(session => session.id === sessionId) || null;
    } catch (error) {
      logService.error(`获取场景会话 ID ${sessionId} 失败:`, error);
      return null;
    }
  }

  /**
   * 添加或更新场景会话
   */
  saveSceneSession(session: SceneSession): void {
    try {
      const sessions = this.getSceneSessions();
      const index = sessions.findIndex(s => s.id === session.id);
      
      if (index >= 0) {
        sessions[index] = { ...session, updatedAt: new Date() };
      } else {
        sessions.push({ ...session, createdAt: new Date(), updatedAt: new Date() });
      }
      
      this.saveSceneSessions(sessions);
      logService.info(`保存场景会话: ${session.name}`);
    } catch (error) {
      logService.error(`保存场景会话 ${session.name} 失败:`, error);
    }
  }

  /**
   * 删除场景会话
   */
  deleteSceneSession(sessionId: string): void {
    try {
      const sessions = this.getSceneSessions();
      const updatedSessions = sessions.filter(session => session.id !== sessionId);
      this.saveSceneSessions(updatedSessions);
      
      logService.info(`删除场景会话 ID: ${sessionId}`);
    } catch (error) {
      logService.error(`删除场景会话 ID ${sessionId} 失败:`, error);
    }
  }

  /**
   * 删除场景的所有会话
   */
  deleteSceneSessions(sceneId: string): void {
    try {
      const allSessions = this.getSceneSessions();
      const updatedSessions = allSessions.filter(session => session.sceneId !== sceneId);
      this.saveSceneSessions(updatedSessions);
      
      logService.info(`删除场景 ID ${sceneId} 的所有会话`);
    } catch (error) {
      logService.error(`删除场景 ID ${sceneId} 的会话失败:`, error);
    }
  }
}

// 导出单例
export const storageService = new StorageService(); 