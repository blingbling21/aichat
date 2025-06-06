import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ProxySettings } from '../types';

/**
 * HTTP请求参数接口
 */
interface HttpRequestParams {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  proxy_config?: ProxyConfig;
}

/**
 * Rust后端的代理配置接口
 */
interface ProxyConfig {
  enabled: boolean;
  proxy_type: string;
  host: string;
  port: number;
  requires_auth: boolean;
  username?: string;
  password?: string;
}

/**
 * HTTP响应接口
 */
interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  success: boolean;
  error?: string;
}

/**
 * 流式请求参数接口
 */
interface StreamRequestParams {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  proxy_config?: ProxyConfig;
  stream_id: string;
}

/**
 * 流式事件接口
 */
interface StreamEvent {
  stream_id: string;
  event_type: string; // "data", "end", "error"
  data?: string;
  error?: string;
}

/**
 * HTTP服务类
 * 通过Tauri后端发送HTTP请求，支持SOCKS5代理
 */
class HttpService {
  /**
   * 将前端代理设置转换为Rust后端格式
   */
  private convertProxySettings(proxySettings: ProxySettings): ProxyConfig | undefined {
    if (!proxySettings.enabled) {
      return undefined;
    }

    // 确保端口是数字类型
    const port = typeof proxySettings.port === 'string' 
      ? parseInt(proxySettings.port, 10) 
      : proxySettings.port;

    return {
      enabled: proxySettings.enabled,
      proxy_type: proxySettings.type,
      host: proxySettings.host,
      port: port,
      requires_auth: proxySettings.requiresAuth,
      username: proxySettings.requiresAuth ? proxySettings.username : undefined,
      password: proxySettings.requiresAuth ? proxySettings.password : undefined,
    };
  }

  /**
   * 发送HTTP请求
   */
  async sendRequest(
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      proxySettings?: ProxySettings;
    } = {}
  ): Promise<HttpResponse> {
    const params: HttpRequestParams = {
      url,
      method: options.method || 'GET',
      headers: options.headers,
      body: options.body,
      proxy_config: options.proxySettings ? this.convertProxySettings(options.proxySettings) : undefined,
    };

    try {
      const response = await invoke<HttpResponse>("send_http_request", { params });
      return response;
    } catch (error) {
      throw new Error(`HTTP请求失败: ${error}`);
    }
  }

  /**
   * 测试代理连接
   */
  async testProxyConnection(proxySettings: ProxySettings): Promise<string> {
    const proxyConfig = this.convertProxySettings(proxySettings);
    
    if (!proxyConfig) {
      throw new Error('代理未启用');
    }

    // 添加调试日志
    console.log('发送到后端的代理配置:', proxyConfig);

    try {
      const result = await invoke<string>("test_proxy_connection", { proxyConfig });
      return result;
    } catch (error) {
      throw new Error(`代理测试失败: ${error}`);
    }
  }

  /**
   * GET请求
   */
  async get(url: string, options: { headers?: Record<string, string>; proxySettings?: ProxySettings } = {}): Promise<HttpResponse> {
    return this.sendRequest(url, { ...options, method: 'GET' });
  }

  /**
   * POST请求
   */
  async post(url: string, options: { headers?: Record<string, string>; body?: string; proxySettings?: ProxySettings } = {}): Promise<HttpResponse> {
    return this.sendRequest(url, { ...options, method: 'POST' });
  }

  /**
   * PUT请求
   */
  async put(url: string, options: { headers?: Record<string, string>; body?: string; proxySettings?: ProxySettings } = {}): Promise<HttpResponse> {
    return this.sendRequest(url, { ...options, method: 'PUT' });
  }

  /**
   * DELETE请求
   */
  async delete(url: string, options: { headers?: Record<string, string>; proxySettings?: ProxySettings } = {}): Promise<HttpResponse> {
    return this.sendRequest(url, { ...options, method: 'DELETE' });
  }

  /**
   * 发送流式HTTP请求
   */
  async sendStreamRequest(
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      proxySettings?: ProxySettings;
      onData?: (data: string) => void;
      onEnd?: () => void;
      onError?: (error: string) => void;
    } = {}
  ): Promise<string> {
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const params: StreamRequestParams = {
      url,
      method: options.method || 'GET',
      headers: options.headers,
      body: options.body,
      proxy_config: options.proxySettings ? this.convertProxySettings(options.proxySettings) : undefined,
      stream_id: streamId,
    };

    // 监听流式事件
    const unlisten = await listen<StreamEvent>('stream-event', (event) => {
      const streamEvent = event.payload;
      
      // 只处理当前流的事件
      if (streamEvent.stream_id !== streamId) {
        return;
      }

      switch (streamEvent.event_type) {
        case 'data':
          if (streamEvent.data && options.onData) {
            options.onData(streamEvent.data);
          }
          break;
        case 'end':
          if (options.onEnd) {
            options.onEnd();
          }
          unlisten(); // 清理监听器
          break;
        case 'error':
          if (streamEvent.error && options.onError) {
            options.onError(streamEvent.error);
          }
          unlisten(); // 清理监听器
          break;
      }
    });

    try {
      const result = await invoke<string>("send_stream_request", { params });
      return result;
    } catch (error) {
      unlisten(); // 发生错误时清理监听器
      throw new Error(`流式HTTP请求失败: ${error}`);
    }
  }
}

// 导出单例实例
export const httpService = new HttpService(); 