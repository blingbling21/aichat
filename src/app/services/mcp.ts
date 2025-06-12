import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { 
  MCPServerConfig, 
  MCPServerStatus, 
  MCPTool, 
  MCPResource, 
  MCPPrompt, 
  MCPToolResult 
} from '../types';
import { logService } from './log';
import { storageService } from './storage';

/**
 * MCP服务管理器
 * 负责管理MCP服务器连接和工具调用
 */
class MCPService {
  private clients: Map<string, Client> = new Map();
  private serverConfigs: Map<string, MCPServerConfig> = new Map();
  private serverStatuses: Map<string, MCPServerStatus> = new Map();

  constructor() {
    this.loadServerConfigs();
  }

  /**
   * 加载服务器配置
   */
  private loadServerConfigs() {
    // 从存储中加载配置，如果没有则使用默认配置
    const configs = storageService.getMCPServerConfigs() || this.getDefaultConfigs();
    
    configs.forEach((config: MCPServerConfig) => {
      this.serverConfigs.set(config.id, config);
      this.serverStatuses.set(config.id, {
        id: config.id,
        connected: false
      });
    });

    logService.info(`已加载 ${configs.length} 个MCP服务器配置`);
  }

  /**
   * 获取默认MCP服务器配置
   */
  private getDefaultConfigs(): MCPServerConfig[] {
    // 返回空配置，用户需要手动添加MCP服务器
    return [];
  }

  /**
   * 初始化所有启用的MCP服务器
   */
  async initializeServers(): Promise<void> {
    const enabledConfigs = Array.from(this.serverConfigs.values()).filter(config => config.enabled);
    
    logService.info(`开始初始化 ${enabledConfigs.length} 个MCP服务器`);

    for (const config of enabledConfigs) {
      try {
        await this.connectToServer(config);
      } catch (error) {
        logService.error(`初始化MCP服务器失败: ${config.name}`, error);
      }
    }
  }

  /**
   * 连接到MCP服务器
   */
  private async connectToServer(config: MCPServerConfig): Promise<void> {
    try {
      logService.info(`连接到MCP服务器: ${config.name}`);

      let client: Client;

      if (config.type === 'builtin') {
        // 内置服务器，直接创建实例
        client = await this.createBuiltinServer(config);
      } else {
        // 外部服务器暂时不支持，返回错误
        throw new Error('外部MCP服务器暂时不支持');
      }

      // 获取服务器能力
      const capabilities = await this.getServerCapabilities(client, config);
      
      this.clients.set(config.id, client);
      this.serverStatuses.set(config.id, {
        id: config.id,
        connected: true,
        capabilities
      });

      logService.info(`MCP服务器连接成功: ${config.name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logService.error(`MCP服务器连接失败: ${config.name}`, error);
      
      this.serverStatuses.set(config.id, {
        id: config.id,
        connected: false,
        lastError: errorMessage
      });
    }
  }

  /**
   * 创建内置MCP服务器
   */
  private async createBuiltinServer(config: MCPServerConfig): Promise<Client> {
    // 创建一个模拟的MCP客户端，用于内置服务器
    const client = new Client(
      { name: `${config.serverClass}-client`, version: '1.0.0' },
      { capabilities: {} }
    );

    // 模拟连接成功
    return client;
  }

  /**
   * 获取服务器能力
   */
  private async getServerCapabilities(client: Client, config: MCPServerConfig): Promise<{
    tools?: MCPTool[];
    resources?: MCPResource[];
    prompts?: MCPPrompt[];
  }> {
    // 根据配置类型返回模拟的能力
    const capabilities: {
      tools?: MCPTool[];
      resources?: MCPResource[];
      prompts?: MCPPrompt[];
    } = {};

    // 根据服务器类型提供不同的工具
    switch (config.serverClass) {
      case 'FilesystemServer':
        capabilities.tools = [
          {
            name: 'read_file',
            description: '读取文件内容',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: '文件路径' }
              },
              required: ['path']
            }
          },
          {
            name: 'write_file',
            description: '写入文件内容',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: '文件路径' },
                content: { type: 'string', description: '文件内容' }
              },
              required: ['path', 'content']
            }
          }
        ];
        break;

      case 'WebSearchServer':
        capabilities.tools = [
          {
            name: 'search_web',
            description: '搜索网页',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: '搜索查询' },
                num_results: { type: 'number', description: '返回结果数量' }
              },
              required: ['query']
            }
          }
        ];
        break;

      case 'CalculatorServer':
        capabilities.tools = [
          {
            name: 'calculate',
            description: '执行数学计算',
            inputSchema: {
              type: 'object',
              properties: {
                expression: { type: 'string', description: '数学表达式' }
              },
              required: ['expression']
            }
          }
        ];
        break;
    }

    return capabilities;
  }

  /**
   * 调用MCP工具
   */
  async callTool(
    serverId: string, 
    toolName: string, 
    arguments_: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const client = this.clients.get(serverId);
    const config = this.serverConfigs.get(serverId);
    
    if (!client || !config) {
      return {
        success: false,
        error: `MCP服务器未找到或未连接: ${serverId}`
      };
    }

    if (!config.permissions.allowToolExecution) {
      return {
        success: false,
        error: `服务器 ${serverId} 不允许执行工具`
      };
    }

    try {
      logService.info(`调用MCP工具: ${serverId}.${toolName}`);
      
      // 根据工具类型执行不同的操作
      const result = await this.executeBuiltinTool(config, toolName, arguments_);

      return {
        success: true,
        content: result,
        metadata: { serverId, toolName }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logService.error(`MCP工具调用失败: ${serverId}.${toolName}`, error);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 执行内置工具
   */
  private async executeBuiltinTool(
    config: MCPServerConfig, 
    toolName: string, 
    arguments_: Record<string, unknown>
  ): Promise<string> {
    switch (config.serverClass) {
      case 'FilesystemServer':
        return this.executeFileSystemTool(toolName, arguments_);
      case 'WebSearchServer':
        return this.executeWebSearchTool(toolName, arguments_);
      case 'CalculatorServer':
        return this.executeCalculatorTool(toolName, arguments_);
      default:
        throw new Error(`未知的服务器类型: ${config.serverClass}`);
    }
  }

  /**
   * 执行文件系统工具
   */
  private async executeFileSystemTool(toolName: string, arguments_: Record<string, unknown>): Promise<string> {
    switch (toolName) {
      case 'read_file':
        // 模拟文件读取
        return `文件内容: ${arguments_.path}`;
      case 'write_file':
        // 模拟文件写入
        return `文件已写入: ${arguments_.path}`;
      default:
        throw new Error(`未知的文件系统工具: ${toolName}`);
    }
  }

  /**
   * 执行网页搜索工具
   */
  private async executeWebSearchTool(toolName: string, arguments_: Record<string, unknown>): Promise<string> {
    switch (toolName) {
      case 'search_web':
        // 模拟网页搜索
        return `搜索结果: ${arguments_.query}`;
      default:
        throw new Error(`未知的网页搜索工具: ${toolName}`);
    }
  }

  /**
   * 执行计算器工具
   */
  private async executeCalculatorTool(toolName: string, arguments_: Record<string, unknown>): Promise<string> {
    switch (toolName) {
      case 'calculate':
        try {
          // 简单的数学表达式计算
          const expression = arguments_.expression as string;
          // 这里应该使用安全的数学表达式求值库
          // 为了演示，我们只处理简单的算术
          const result = eval(expression.replace(/[^0-9+\-*/().\s]/g, ''));
          return `计算结果: ${expression} = ${result}`;
        } catch (error) {
          throw new Error(`计算错误: ${error}`);
        }
      default:
        throw new Error(`未知的计算器工具: ${toolName}`);
    }
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools(): MCPTool[] {
    const tools: MCPTool[] = [];
    
    for (const status of this.serverStatuses.values()) {
      if (status.connected && status.capabilities?.tools) {
        tools.push(...status.capabilities.tools);
      }
    }

    return tools;
  }

  /**
   * 获取服务器状态
   */
  getServerStatuses(): MCPServerStatus[] {
    return Array.from(this.serverStatuses.values());
  }

  /**
   * 获取服务器配置
   */
  getServerConfigs(): MCPServerConfig[] {
    return Array.from(this.serverConfigs.values());
  }

  /**
   * 更新服务器配置
   */
  async updateServerConfig(config: MCPServerConfig): Promise<void> {
    this.serverConfigs.set(config.id, config);
    
    // 保存到存储
    const configs = Array.from(this.serverConfigs.values());
    storageService.saveMCPServerConfigs(configs);
    
    // 如果服务器已连接，需要重新连接
    if (this.clients.has(config.id)) {
      await this.disconnectFromServer(config.id);
      if (config.enabled) {
        await this.connectToServer(config);
      }
    }
  }

  /**
   * 删除服务器配置
   */
  async deleteServerConfig(serverId: string): Promise<void> {
    // 先断开连接
    if (this.clients.has(serverId)) {
      await this.disconnectFromServer(serverId);
    }
    
    // 删除配置和状态
    this.serverConfigs.delete(serverId);
    this.serverStatuses.delete(serverId);
    
    // 保存到存储
    const configs = Array.from(this.serverConfigs.values());
    storageService.saveMCPServerConfigs(configs);
  }

  /**
   * 断开服务器连接
   */
  private async disconnectFromServer(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (client) {
      try {
        // 模拟断开连接
        // await client.close();
      } catch (error) {
        logService.error(`断开MCP服务器连接失败: ${serverId}`, error);
      }
      
      this.clients.delete(serverId);
      
      const status = this.serverStatuses.get(serverId);
      if (status) {
        status.connected = false;
        status.capabilities = undefined;
      }
    }
  }

  /**
   * 关闭所有连接
   */
  async close(): Promise<void> {
    const serverIds = Array.from(this.clients.keys());
    
    for (const serverId of serverIds) {
      await this.disconnectFromServer(serverId);
    }
    
    logService.info('所有MCP服务器连接已关闭');
  }
}

// 创建全局实例
export const mcpService = new MCPService(); 