import { AIProvider, ProxySettings } from '../types';

/**
 * 存储服务类
 * 用于统一管理本地存储操作
 */
class StorageService {
  private readonly providersKey = 'aiProviders';
  private readonly proxyKey = 'proxySettings';

  /**
   * 获取AI提供商列表
   */
  getProviders(): AIProvider[] {
    try {
      const providers = window.localStorage.getItem(this.providersKey);
      return providers ? JSON.parse(providers) : [];
    } catch (error) {
      console.error('获取AI提供商失败:', error);
      return [];
    }
  }

  /**
   * 保存AI提供商列表
   */
  saveProviders(providers: AIProvider[]): void {
    try {
      window.localStorage.setItem(this.providersKey, JSON.stringify(providers));
    } catch (error) {
      console.error('保存AI提供商失败:', error);
    }
  }

  /**
   * 获取代理设置
   */
  getProxySettings(): ProxySettings {
    try {
      const settings = window.localStorage.getItem(this.proxyKey);
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
      console.error('获取代理设置失败:', error);
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
      window.localStorage.setItem(this.proxyKey, JSON.stringify(settings));
    } catch (error) {
      console.error('保存代理设置失败:', error);
    }
  }

  /**
   * 获取当前选择的AI提供商ID
   */
  getSelectedProviderId(): string {
    try {
      return window.localStorage.getItem('selectedProviderId') || 'default';
    } catch (error) {
      console.error('获取选中提供商ID失败:', error);
      return 'default';
    }
  }

  /**
   * 保存当前选择的AI提供商ID
   */
  saveSelectedProviderId(id: string): void {
    try {
      window.localStorage.setItem('selectedProviderId', id);
    } catch (error) {
      console.error('保存选中提供商ID失败:', error);
    }
  }
}

// 导出单例
export const storageService = new StorageService(); 