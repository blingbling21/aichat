import { invoke } from "@tauri-apps/api/core";

/**
 * 日志服务类
 *
 * 此服务提供统一的日志记录接口，将前端日志传递给Tauri后端进行处理。
 * 如果Tauri环境不可用，则自动降级到浏览器控制台。
 *
 * @class LogService
 */
class LogService {
  /**
   * 记录信息级别日志
   *
   * 用于记录一般信息，如操作成功、功能正常工作等。
   *
   * @param {string} message - 要记录的信息内容
   * @returns {Promise<void>}
   *
   * @example
   * ```typescript
   * logService.info('用户登录成功');
   * ```
   */
  async info(message: string): Promise<void> {
    await invoke("log_info", { message });
  }

  /**
   * 记录警告级别日志
   *
   * 用于记录潜在问题或需要注意的情况，但不影响程序主要功能。
   *
   * @param {string} message - 要记录的警告内容
   * @returns {Promise<void>}
   *
   * @example
   * ```typescript
   * logService.warn('API密钥即将过期');
   * ```
   */
  async warn(message: string): Promise<void> {
    await invoke("log_warn", { message });
  }

  /**
   * 记录错误级别日志
   *
   * 用于记录程序错误、异常或失败情况。
   *
   * @param {string} message - 错误描述
   * @param {unknown} [errorObj] - 可选的错误对象或额外信息
   * @returns {Promise<void>}
   *
   * @example
   * ```typescript
   * try {
   *   // 某些可能失败的操作
   * } catch (error) {
   *   logService.error('API请求失败', error);
   * }
   * ```
   */
  async error(message: string, errorObj?: unknown): Promise<void> {
    let fullMessage = message;
    if (errorObj) {
      fullMessage += `: ${
        errorObj instanceof Error ? errorObj.message : JSON.stringify(errorObj)
      }`;
    }

    await invoke("log_error", { message: fullMessage });
  }

  /**
   * 记录调试级别日志
   *
   * 用于记录详细的调试信息，通常在开发过程中使用。
   *
   * @param {string} message - 要记录的调试信息
   * @returns {Promise<void>}
   *
   * @example
   * ```typescript
   * logService.debug('组件渲染完成，状态: ' + JSON.stringify(state));
   * ```
   */
  async debug(message: string): Promise<void> {
    await invoke("log_debug", { message });
  }
}

// 导出日志服务单例
export const logService = new LogService();
