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
import { filesystemService } from './filesystem';

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
   * 强制重新加载服务器配置
   */
  reloadServerConfigs(): void {
    // 清空现有配置
    this.serverConfigs.clear();
    this.serverStatuses.clear();
    this.clients.clear();
    
    // 重新加载配置
    this.loadServerConfigs();
    
    logService.info('已强制重新加载MCP服务器配置');
  }

  /**
   * 加载服务器配置
   */
  private loadServerConfigs() {
    // 从存储中加载配置
    let configs = storageService.getMCPServerConfigs();
    
    logService.info(`从存储中读取到的配置: ${configs ? configs.length : 0} 个`);
    
    // 如果没有配置，使用默认配置并保存
    if (!configs || configs.length === 0) {
      configs = this.getDefaultConfigs();
      storageService.saveMCPServerConfigs(configs);
      logService.info(`首次加载，已保存默认MCP配置: ${configs.length} 个`);
      
      // 验证保存是否成功
      const savedConfigs = storageService.getMCPServerConfigs();
      logService.info(`验证保存结果: ${savedConfigs ? savedConfigs.length : 0} 个配置`);
    }
    
    configs.forEach((config: MCPServerConfig) => {
      this.serverConfigs.set(config.id, config);
      this.serverStatuses.set(config.id, {
        id: config.id,
        connected: false
      });
      logService.info(`加载配置: ${config.name} (${config.id}), 启用: ${config.enabled}`);
    });

    logService.info(`已加载 ${configs.length} 个MCP服务器配置`);
  }

  /**
   * 获取默认MCP服务器配置
   */
  private getDefaultConfigs(): MCPServerConfig[] {
    // 返回内置的文件系统服务器配置
    return [
      {
        id: 'builtin-filesystem',
        name: '文件系统服务',
        description: '内置文件系统操作服务，提供文件读写、目录管理等功能',
        enabled: true,
        type: 'builtin',
        serverClass: 'FilesystemServer',
        capabilities: {
          tools: true,
          resources: false,
          prompts: false
        },
        permissions: {
          allowToolExecution: true,
          allowResourceAccess: false
        }
      }
    ];
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
          },
          {
            name: 'list_directory',
            description: '列出目录内容',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: '目录路径' }
              },
              required: ['path']
            }
          },
          {
            name: 'create_directory',
            description: '创建目录',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: '目录路径' }
              },
              required: ['path']
            }
          },
          {
            name: 'delete_file',
            description: '删除文件',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: '文件路径' }
              },
              required: ['path']
            }
          },
          {
            name: 'delete_directory',
            description: '删除目录',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: '目录路径' }
              },
              required: ['path']
            }
          },
          {
            name: 'move_item',
            description: '移动或重命名文件/目录',
            inputSchema: {
              type: 'object',
              properties: {
                source: { type: 'string', description: '源路径' },
                target: { type: 'string', description: '目标路径' }
              },
              required: ['source', 'target']
            }
          },
          {
            name: 'copy_file',
            description: '复制文件',
            inputSchema: {
              type: 'object',
              properties: {
                source: { type: 'string', description: '源文件路径' },
                target: { type: 'string', description: '目标文件路径' }
              },
              required: ['source', 'target']
            }
          },
          {
            name: 'get_item_info',
            description: '获取文件或目录信息',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: '文件或目录路径' }
              },
              required: ['path']
            }
          },
          {
            name: 'search_files',
            description: '搜索文件',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: '搜索目录路径' },
                pattern: { type: 'string', description: '搜索模式（正则表达式）' },
                recursive: { type: 'boolean', description: '是否递归搜索' },
                case_sensitive: { type: 'boolean', description: '是否区分大小写' },
                file_only: { type: 'boolean', description: '是否只搜索文件' }
              },
              required: ['path', 'pattern']
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
      case 'read_file': {
        const path = arguments_.path as string;
        const content = await filesystemService.readFile(path);
        return `文件内容已读取，共 ${content.length} 个字符:\n\n${content}`;
      }
      
      case 'write_file': {
        const path = arguments_.path as string;
        const content = arguments_.content as string;
        await filesystemService.writeFile(path, content);
        return `文件已成功写入: ${path} (${content.length} 个字符)`;
      }
      
      case 'list_directory': {
        const path = arguments_.path as string;
        const items = await filesystemService.listDirectory(path);
        const itemsText = items.map(item => {
          const sizeText = item.size ? ` (${item.size} bytes)` : '';
          const modifiedText = item.modified ? ` - 修改时间: ${item.modified.toLocaleString()}` : '';
          return `${item.type === 'directory' ? '📁' : '📄'} ${item.name}${sizeText}${modifiedText}`;
        }).join('\n');
        return `目录内容 (${path}):\n${itemsText || '目录为空'}`;
      }
      
      case 'create_directory': {
        const path = arguments_.path as string;
        await filesystemService.createDirectory(path);
        return `目录已创建: ${path}`;
      }
      
      case 'delete_file': {
        const path = arguments_.path as string;
        await filesystemService.deleteFile(path);
        return `文件已删除: ${path}`;
      }
      
      case 'delete_directory': {
        const path = arguments_.path as string;
        await filesystemService.deleteDirectory(path);
        return `目录已删除: ${path}`;
      }
      
      case 'move_item': {
        const source = arguments_.source as string;
        const target = arguments_.target as string;
        await filesystemService.moveItem(source, target);
        return `已移动: ${source} -> ${target}`;
      }
      
      case 'copy_file': {
        const source = arguments_.source as string;
        const target = arguments_.target as string;
        await filesystemService.copyFile(source, target);
        return `文件已复制: ${source} -> ${target}`;
      }
      
      case 'get_item_info': {
        const path = arguments_.path as string;
        const info = await filesystemService.getItemInfo(path);
        return `文件信息 (${path}):\n` +
               `类型: ${info.type === 'file' ? '文件' : '目录'}\n` +
               `大小: ${info.size} bytes\n` +
               `创建时间: ${info.created.toLocaleString()}\n` +
               `修改时间: ${info.modified.toLocaleString()}\n` +
               `访问时间: ${info.accessed.toLocaleString()}\n` +
               `权限: ${info.permissions}`;
      }
      
      case 'search_files': {
        const path = arguments_.path as string;
        const pattern = arguments_.pattern as string;
        const recursive = arguments_.recursive as boolean ?? true;
        const caseSensitive = arguments_.case_sensitive as boolean ?? false;
        const fileOnly = arguments_.file_only as boolean ?? true;
        
        const results = await filesystemService.searchFiles(path, pattern, {
          recursive,
          caseSensitive,
          fileOnly
        });
        
        if (results.length === 0) {
          return `未找到匹配的文件 (搜索路径: ${path}, 模式: ${pattern})`;
        }
        
        return `找到 ${results.length} 个匹配的文件:\n${results.join('\n')}`;
      }
      
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