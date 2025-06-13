# 内置文件系统服务

本应用内置了一个完整的文件系统MCP服务，提供安全的文件操作功能。

## 功能特性

### 🔧 支持的操作

1. **文件操作**
   - `read_file` - 读取文件内容
   - `write_file` - 写入文件内容
   - `delete_file` - 删除文件
   - `copy_file` - 复制文件

2. **目录操作**
   - `list_directory` - 列出目录内容
   - `create_directory` - 创建目录
   - `delete_directory` - 删除目录

3. **通用操作**
   - `move_item` - 移动/重命名文件或目录
   - `get_item_info` - 获取文件或目录信息
   - `search_files` - 搜索文件

### 🛡️ 安全特性

- **路径限制**：只能访问允许的路径范围内的文件
- **文件类型限制**：支持常见的文本文件和代码文件格式
- **大小限制**：单个文件最大10MB
- **操作日志**：所有操作都会记录日志

### 📁 支持的文件类型

```
.txt, .md, .json, .js, .ts, .jsx, .tsx, 
.css, .scss, .html, .xml, .yaml, .yml,
.py, .java, .cpp, .c, .h, .cs, .php,
.rb, .go, .rs, .swift, .kt, .scala,
.sql, .sh, .bat, .ps1, .dockerfile,
.gitignore, .env, .config, .ini, .toml
```

## 使用方法

### 1. 在MCP设置中启用

文件系统服务是内置服务，默认已启用。你可以在MCP设置页面中查看其状态。

### 2. 在聊天中使用

直接用自然语言描述你的需求，AI会自动选择合适的文件系统工具：

```
用户：请读取当前目录下的package.json文件
AI：我来为你读取package.json文件的内容...

用户：创建一个名为test.txt的文件，内容是"Hello World"
AI：我来为你创建test.txt文件...

用户：列出src目录下的所有文件
AI：我来列出src目录的内容...
```

### 3. 工具参数说明

#### read_file
```json
{
  "path": "文件路径"
}
```

#### write_file
```json
{
  "path": "文件路径",
  "content": "文件内容"
}
```

#### list_directory
```json
{
  "path": "目录路径"
}
```

#### create_directory
```json
{
  "path": "目录路径"
}
```

#### delete_file
```json
{
  "path": "文件路径"
}
```

#### delete_directory
```json
{
  "path": "目录路径"
}
```

#### move_item
```json
{
  "source": "源路径",
  "target": "目标路径"
}
```

#### copy_file
```json
{
  "source": "源文件路径",
  "target": "目标文件路径"
}
```

#### get_item_info
```json
{
  "path": "文件或目录路径"
}
```

#### search_files
```json
{
  "path": "搜索目录路径",
  "pattern": "搜索模式（正则表达式）",
  "recursive": true,
  "case_sensitive": false,
  "file_only": true
}
```

## 配置选项

### 设置允许的路径

```typescript
import { filesystemService } from './services/filesystem';

// 设置允许访问的路径
filesystemService.setAllowedPaths([
  '/path/to/project',
  '/path/to/documents'
]);
```

### 默认配置

- **允许路径**：当前工作目录
- **最大文件大小**：10MB
- **支持的扩展名**：见上面的列表

## 错误处理

服务会对以下情况返回错误：

1. **访问被拒绝**：尝试访问不在允许范围内的路径
2. **文件类型不支持**：尝试操作不支持的文件类型
3. **文件过大**：文件大小超过限制
4. **文件不存在**：尝试读取不存在的文件
5. **权限不足**：没有足够的权限执行操作

## 最佳实践

1. **使用相对路径**：推荐使用相对路径，如 `./src/file.txt`
2. **检查文件大小**：大文件操作前先检查大小
3. **备份重要文件**：删除操作前确保有备份
4. **使用描述性路径**：使用清晰的文件和目录名称

## 示例场景

### 代码项目管理
```
用户：帮我创建一个新的React组件文件
AI：我来为你创建React组件文件...

用户：读取src/components目录下的所有TypeScript文件
AI：我来列出并读取TypeScript文件...
```

### 文档处理
```
用户：将README.md文件的内容复制到docs/readme-backup.md
AI：我来复制README.md文件...

用户：搜索所有包含"TODO"的文件
AI：我来搜索包含"TODO"的文件...
```

### 项目维护
```
用户：清理临时文件，删除所有.tmp文件
AI：我来搜索并删除.tmp文件...

用户：检查package.json文件的修改时间
AI：我来获取package.json的文件信息...
```

## 故障排除

### 常见问题

1. **"访问被拒绝"错误**
   - 检查文件路径是否在允许范围内
   - 确认路径格式正确

2. **"文件类型不支持"错误**
   - 检查文件扩展名是否在支持列表中
   - 考虑重命名文件或使用支持的格式

3. **"文件过大"错误**
   - 检查文件大小是否超过10MB限制
   - 考虑分割大文件或使用其他方式处理

### 调试技巧

1. 查看浏览器控制台的日志输出
2. 使用MCP设置页面检查服务状态
3. 先测试简单操作，如列出目录
4. 使用演示页面测试各种功能

## 技术实现

文件系统服务基于以下技术：

- **Node.js fs/promises API**：底层文件操作
- **路径安全检查**：防止路径遍历攻击
- **文件类型验证**：基于扩展名的白名单
- **错误处理**：完整的错误捕获和报告
- **日志记录**：操作审计和调试支持

## 扩展开发

如需扩展文件系统服务功能：

1. 修改 `src/app/services/filesystem.ts` 添加新方法
2. 更新 `src/app/services/mcp.ts` 中的工具定义
3. 添加相应的错误处理和日志记录
4. 更新文档和测试用例 