import { invoke } from '@tauri-apps/api/core';
import { logService } from './log';

/**
 * 文件系统操作结果接口
 */
interface FileSystemResult {
  success: boolean;
  data?: string;
  error?: string;
}

/**
 * 目录项接口
 */
interface DirectoryItem {
  name: string;
  item_type: string;
  size?: number;
  modified?: string;
}

/**
 * 文件信息接口
 */
interface FileInfo {
  name: string;
  item_type: string;
  size: number;
  created?: string;
  modified?: string;
  accessed?: string;
  permissions: string;
}

/**
 * 搜索选项接口
 */
interface SearchOptions {
  recursive?: boolean;
  case_sensitive?: boolean;
  file_only?: boolean;
}

/**
 * 文件系统服务
 * 通过Tauri命令调用Rust后端进行文件操作
 */
export class FilesystemService {
  /**
   * 读取文件内容
   */
  async readFile(filePath: string): Promise<string> {
    try {
      logService.info(`文件系统服务：读取文件 ${filePath}`);
      
      const result: FileSystemResult = await invoke('fs_read_file', { path: filePath });
      
      if (result.success && result.data) {
        logService.info(`文件系统服务：读取文件成功 ${filePath}`);
        return result.data;
      } else {
        const error = result.error || '读取文件失败';
        logService.error(`文件系统服务：读取文件失败 ${filePath}`, error);
        throw new Error(error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logService.error(`文件系统服务：读取文件失败 ${filePath}`, error);
      throw new Error(`读取文件失败：${errorMessage}`);
    }
  }

  /**
   * 写入文件内容
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      logService.info(`文件系统服务：写入文件 ${filePath} (${content.length} 字符)`);
      
      const result: FileSystemResult = await invoke('fs_write_file', { 
        path: filePath, 
        content: content 
      });
      
      if (result.success) {
        logService.info(`文件系统服务：写入文件成功 ${filePath}`);
      } else {
        const error = result.error || '写入文件失败';
        logService.error(`文件系统服务：写入文件失败 ${filePath}`, error);
        throw new Error(error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logService.error(`文件系统服务：写入文件失败 ${filePath}`, error);
      throw new Error(`写入文件失败：${errorMessage}`);
    }
  }

  /**
   * 列出目录内容
   */
  async listDirectory(dirPath: string): Promise<{
    name: string;
    type: 'file' | 'directory';
    size?: number;
    modified?: Date;
  }[]> {
    try {
      logService.info(`文件系统服务：列出目录 ${dirPath}`);
      
      const result: FileSystemResult = await invoke('fs_list_directory', { path: dirPath });
      
      if (result.success && result.data) {
        const items: DirectoryItem[] = JSON.parse(result.data);
        const formattedItems = items.map(item => ({
          name: item.name,
          type: item.item_type as 'file' | 'directory',
          size: item.size,
          modified: item.modified ? new Date(item.modified) : undefined
        }));
        
        logService.info(`文件系统服务：列出目录成功 ${dirPath} (${formattedItems.length} 项)`);
        return formattedItems;
      } else {
        const error = result.error || '列出目录失败';
        logService.error(`文件系统服务：列出目录失败 ${dirPath}`, error);
        throw new Error(error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logService.error(`文件系统服务：列出目录失败 ${dirPath}`, error);
      throw new Error(`列出目录失败：${errorMessage}`);
    }
  }

  /**
   * 创建目录
   */
  async createDirectory(dirPath: string): Promise<void> {
    try {
      logService.info(`文件系统服务：创建目录 ${dirPath}`);
      
      const result: FileSystemResult = await invoke('fs_create_directory', { path: dirPath });
      
      if (result.success) {
        logService.info(`文件系统服务：创建目录成功 ${dirPath}`);
      } else {
        const error = result.error || '创建目录失败';
        logService.error(`文件系统服务：创建目录失败 ${dirPath}`, error);
        throw new Error(error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logService.error(`文件系统服务：创建目录失败 ${dirPath}`, error);
      throw new Error(`创建目录失败：${errorMessage}`);
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      logService.info(`文件系统服务：删除文件 ${filePath}`);
      
      const result: FileSystemResult = await invoke('fs_delete_file', { path: filePath });
      
      if (result.success) {
        logService.info(`文件系统服务：删除文件成功 ${filePath}`);
      } else {
        const error = result.error || '删除文件失败';
        logService.error(`文件系统服务：删除文件失败 ${filePath}`, error);
        throw new Error(error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logService.error(`文件系统服务：删除文件失败 ${filePath}`, error);
      throw new Error(`删除文件失败：${errorMessage}`);
    }
  }

  /**
   * 删除目录
   */
  async deleteDirectory(dirPath: string): Promise<void> {
    try {
      logService.info(`文件系统服务：删除目录 ${dirPath}`);
      
      const result: FileSystemResult = await invoke('fs_delete_directory', { path: dirPath });
      
      if (result.success) {
        logService.info(`文件系统服务：删除目录成功 ${dirPath}`);
      } else {
        const error = result.error || '删除目录失败';
        logService.error(`文件系统服务：删除目录失败 ${dirPath}`, error);
        throw new Error(error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logService.error(`文件系统服务：删除目录失败 ${dirPath}`, error);
      throw new Error(`删除目录失败：${errorMessage}`);
    }
  }

  /**
   * 移动/重命名文件或目录
   */
  async moveItem(sourcePath: string, targetPath: string): Promise<void> {
    try {
      logService.info(`文件系统服务：移动 ${sourcePath} -> ${targetPath}`);
      
      const result: FileSystemResult = await invoke('fs_move_item', { 
        source: sourcePath, 
        target: targetPath 
      });
      
      if (result.success) {
        logService.info(`文件系统服务：移动成功 ${sourcePath} -> ${targetPath}`);
      } else {
        const error = result.error || '移动失败';
        logService.error(`文件系统服务：移动失败 ${sourcePath} -> ${targetPath}`, error);
        throw new Error(error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logService.error(`文件系统服务：移动失败 ${sourcePath} -> ${targetPath}`, error);
      throw new Error(`移动失败：${errorMessage}`);
    }
  }

  /**
   * 复制文件
   */
  async copyFile(sourcePath: string, targetPath: string): Promise<void> {
    try {
      logService.info(`文件系统服务：复制文件 ${sourcePath} -> ${targetPath}`);
      
      const result: FileSystemResult = await invoke('fs_copy_file', { 
        source: sourcePath, 
        target: targetPath 
      });
      
      if (result.success) {
        logService.info(`文件系统服务：复制文件成功 ${sourcePath} -> ${targetPath}`);
      } else {
        const error = result.error || '复制文件失败';
        logService.error(`文件系统服务：复制文件失败 ${sourcePath} -> ${targetPath}`, error);
        throw new Error(error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logService.error(`文件系统服务：复制文件失败 ${sourcePath} -> ${targetPath}`, error);
      throw new Error(`复制文件失败：${errorMessage}`);
    }
  }

  /**
   * 获取文件或目录信息
   */
  async getItemInfo(itemPath: string): Promise<{
    name: string;
    type: 'file' | 'directory';
    size: number;
    created: Date;
    modified: Date;
    accessed: Date;
    permissions: string;
  }> {
    try {
      logService.info(`文件系统服务：获取信息 ${itemPath}`);
      
      const result: FileSystemResult = await invoke('fs_get_item_info', { path: itemPath });
      
      if (result.success && result.data) {
        const info: FileInfo = JSON.parse(result.data);
        const formattedInfo = {
          name: info.name,
          type: info.item_type as 'file' | 'directory',
          size: info.size,
          created: info.created ? new Date(info.created) : new Date(),
          modified: info.modified ? new Date(info.modified) : new Date(),
          accessed: info.accessed ? new Date(info.accessed) : new Date(),
          permissions: info.permissions
        };
        
        logService.info(`文件系统服务：获取信息成功 ${itemPath}`);
        return formattedInfo;
      } else {
        const error = result.error || '获取信息失败';
        logService.error(`文件系统服务：获取信息失败 ${itemPath}`, error);
        throw new Error(error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logService.error(`文件系统服务：获取信息失败 ${itemPath}`, error);
      throw new Error(`获取信息失败：${errorMessage}`);
    }
  }

  /**
   * 搜索文件
   */
  async searchFiles(dirPath: string, pattern: string, options: {
    recursive?: boolean;
    caseSensitive?: boolean;
    fileOnly?: boolean;
  } = {}): Promise<string[]> {
    try {
      logService.info(`文件系统服务：搜索文件 ${dirPath} 模式:"${pattern}"`);
      
      const searchOptions: SearchOptions = {
        recursive: options.recursive,
        case_sensitive: options.caseSensitive,
        file_only: options.fileOnly
      };
      
      const result: FileSystemResult = await invoke('fs_search_files', { 
        path: dirPath, 
        pattern: pattern,
        options: searchOptions
      });
      
      if (result.success && result.data) {
        const results: string[] = JSON.parse(result.data);
        logService.info(`文件系统服务：搜索文件成功 ${dirPath} 找到 ${results.length} 个结果`);
        return results;
      } else {
        const error = result.error || '搜索文件失败';
        logService.error(`文件系统服务：搜索文件失败 ${dirPath}`, error);
        throw new Error(error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logService.error(`文件系统服务：搜索文件失败 ${dirPath}`, error);
      throw new Error(`搜索文件失败：${errorMessage}`);
    }
  }

  /**
   * 设置允许访问的路径（在Rust后端中已实现安全检查）
   */
  setAllowedPaths(paths: string[]) {
    logService.info(`文件系统服务：路径限制由Rust后端管理，当前工作目录: ${paths.join(', ')}`);
  }
}

// 创建全局实例
export const filesystemService = new FilesystemService(); 