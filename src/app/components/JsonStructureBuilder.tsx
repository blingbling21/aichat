"use client";

import React, { useState, useCallback } from 'react';
import { JsonNode, MessageStructureConfig } from '../types';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronRight, 
  Eye,
  Code,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';

// 模板数据类型
type TemplateData = Record<string, string | number | boolean>;

// JSON模板生成结果类型
type JsonTemplateResult = string | number | boolean | JsonTemplateResult[] | { [key: string]: JsonTemplateResult };

interface JsonStructureBuilderProps {
  config: MessageStructureConfig;
  onChange: (config: MessageStructureConfig) => void;
  fieldPath: string; // 用于显示当前配置的字段路径
}

interface JsonNodeEditorProps {
  node: JsonNode;
  onChange: (updatedNode: JsonNode) => void;
  onDelete?: () => void;
  level: number;
  isArrayItem?: boolean;
}

// 可用的模板变量
const TEMPLATE_VARIABLES = [
  { value: 'role', label: '角色 (role)', description: '消息发送者角色' },
  { value: 'content', label: '内容 (content)', description: '消息内容' },
  { value: 'message', label: '当前消息 (message)', description: '用户当前发送的消息' },
  { value: 'model', label: '模型 (model)', description: '使用的AI模型' },
  { value: 'stream', label: '流式 (stream)', description: '是否启用流式返回' },
  { value: 'temperature', label: '温度 (temperature)', description: '生成参数温度' },
  { value: 'apiKey', label: 'API密钥 (apiKey)', description: 'API认证密钥' },
];

// 预设的JSON结构模板
const PRESET_TEMPLATES = {
  openai: {
    name: 'OpenAI格式',
    structure: {
      id: 'root',
      type: 'array' as const,
      key: 'messages',
      description: 'OpenAI消息数组格式',
      arrayItemTemplate: {
        id: 'message-item',
        type: 'object' as const,
        children: [
          {
            id: 'role',
            type: 'template' as const,
            key: 'role',
            templateVariable: 'role',
            description: '消息角色'
          },
          {
            id: 'content',
            type: 'template' as const,
            key: 'content',
            templateVariable: 'content',
            description: '消息内容'
          }
        ]
      }
    }
  },
  gemini: {
    name: 'Gemini格式',
    structure: {
      id: 'root',
      type: 'array' as const,
      key: 'contents',
      description: 'Gemini消息数组格式',
      arrayItemTemplate: {
        id: 'content-item',
        type: 'object' as const,
        children: [
          {
            id: 'role',
            type: 'template' as const,
            key: 'role',
            templateVariable: 'role',
            description: '消息角色'
          },
          {
            id: 'parts',
            type: 'array' as const,
            key: 'parts',
            description: '消息部分数组',
            arrayItemTemplate: {
              id: 'part-item',
              type: 'object' as const,
              children: [
                {
                  id: 'text',
                  type: 'template' as const,
                  key: 'text',
                  templateVariable: 'content',
                  description: '文本内容'
                }
              ]
            }
          }
        ]
      }
    }
  },
  custom: {
    name: '自定义格式',
    structure: {
      id: 'root',
      type: 'array' as const,
      key: '',
      description: '自定义消息格式',
      children: []
    }
  }
};

// JSON节点编辑器
const JsonNodeEditor: React.FC<JsonNodeEditorProps> = ({ 
  node, 
  onChange, 
  onDelete, 
  level,
  isArrayItem = false 
}) => {
  const [expanded, setExpanded] = useState(level < 1); // 默认只展开第一层
  const [showDescription, setShowDescription] = useState(false);

  // 更新节点属性
  const updateNode = useCallback((updates: Partial<JsonNode>) => {
    onChange({ ...node, ...updates });
  }, [node, onChange]);

  // 添加子节点
  const addChild = useCallback(() => {
    const newChild: JsonNode = {
      id: `${node.id}-${Date.now()}`,
      type: 'string',
      key: '',
      value: '',
      description: ''
    };
    
    const children = node.children || [];
    updateNode({ children: [...children, newChild] });
  }, [node, updateNode]);

  // 更新子节点
  const updateChild = useCallback((index: number, updatedChild: JsonNode) => {
    const children = [...(node.children || [])];
    children[index] = updatedChild;
    updateNode({ children });
  }, [node.children, updateNode]);

  // 删除子节点
  const deleteChild = useCallback((index: number) => {
    const children = [...(node.children || [])];
    children.splice(index, 1);
    updateNode({ children });
  }, [node.children, updateNode]);



  // 渲染值编辑器
  const renderValueEditor = () => {
    switch (node.type) {
      case 'template':
        return (
          <Select
            value={node.templateVariable || ''}
            onValueChange={(value) => updateNode({ templateVariable: value })}
          >
            <SelectTrigger className="h-5 text-xs border-0 bg-transparent p-1 focus:bg-white focus:border">
              <SelectValue placeholder="选择模板变量" />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_VARIABLES.map(tmpl => (
                <SelectItem key={tmpl.value} value={tmpl.value}>
                  {tmpl.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case 'string':
        return (
          <Input
            value={node.value?.toString() || ''}
            onChange={(e) => updateNode({ value: e.target.value })}
            placeholder="字符串值"
            className="h-5 text-xs border-0 bg-transparent p-1 focus:bg-white focus:border"
          />
        );
      
      case 'number':
        return (
          <Input
            type="number"
            value={node.value?.toString() || ''}
            onChange={(e) => updateNode({ value: parseFloat(e.target.value) || 0 })}
            placeholder="数字值"
            className="h-5 text-xs border-0 bg-transparent p-1 focus:bg-white focus:border"
          />
        );
      
      case 'boolean':
        return (
          <Select
            value={node.value?.toString() || 'false'}
            onValueChange={(value) => updateNode({ value: value === 'true' })}
          >
            <SelectTrigger className="h-5 text-xs border-0 bg-transparent p-1 focus:bg-white focus:border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">true</SelectItem>
              <SelectItem value="false">false</SelectItem>
            </SelectContent>
          </Select>
        );
      
      case 'object':
      case 'array':
        return (
          <span className="text-xs text-gray-500 italic">
            {node.type === 'object' ? '对象容器' : '数组容器'}
          </span>
        );
      
      default:
        return null;
    }
  };

  const canHaveChildren = node.type === 'object';
  const isArray = node.type === 'array';

  return (
    <div className={`${level > 0 ? 'ml-3 border-l border-gray-200 pl-2' : ''}`}>
      {/* 主行 - 表格式布局 */}
      <div className="flex items-center gap-1 py-1 hover:bg-gray-50 rounded group">
        {/* 展开/折叠按钮 */}
        <div className="w-4 flex justify-center">
          {(canHaveChildren || isArray) ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="p-0 h-4 w-4 opacity-60 group-hover:opacity-100"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          ) : null}
        </div>
        
        {/* 键名 */}
        {!isArrayItem && (
          <div className="w-20">
            <Input
              value={node.key || ''}
              onChange={(e) => updateNode({ key: e.target.value })}
              placeholder="键名"
              className="h-5 text-xs border-0 bg-transparent p-1 focus:bg-white focus:border"
            />
          </div>
        )}
        
        {/* 类型选择 */}
        <div className="w-16">
          <Select
            value={node.type}
            onValueChange={(value: JsonNode['type']) => updateNode({ type: value })}
          >
            <SelectTrigger className="h-5 text-xs border-0 bg-transparent p-1 focus:bg-white focus:border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="object">对象</SelectItem>
              <SelectItem value="array">数组</SelectItem>
              <SelectItem value="string">字符串</SelectItem>
              <SelectItem value="number">数字</SelectItem>
              <SelectItem value="boolean">布尔值</SelectItem>
              <SelectItem value="template">模板</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* 值编辑器 */}
        <div className="flex-1 min-w-0">
          {renderValueEditor()}
        </div>
        
        {/* 操作按钮 */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDescription(!showDescription)}
            className="h-5 w-5 p-0 text-gray-600 hover:text-gray-700"
            title="编辑描述"
          >
            <Settings className="h-3 w-3" />
          </Button>
          
          {canHaveChildren && (
            <Button
              variant="ghost"
              size="sm"
              onClick={addChild}
              className="h-5 w-5 p-0 text-green-600 hover:text-green-700"
              title="添加子节点"
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
          
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="h-5 w-5 p-0 text-red-600 hover:text-red-700"
              title="删除节点"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      
      {/* 描述编辑区域 */}
      {showDescription && (
        <div className="ml-5 py-1">
          <Input
            value={node.description || ''}
            onChange={(e) => updateNode({ description: e.target.value })}
            placeholder="节点描述（可选）"
            className="h-5 text-xs"
          />
        </div>
      )}
      
      {/* 描述显示 */}
      {!showDescription && node.description && (
        <div className="text-xs text-gray-500 ml-5 mb-1">
          {node.description}
        </div>
      )}
      
      {/* 子节点区域 */}
      {expanded && (
        <div className="space-y-0">
          {/* 数组项模板 */}
          {isArray && (
            <div className="ml-5 py-1">
              <div className="text-xs text-gray-600 mb-1">数组项模板:</div>
              <JsonNodeEditor
                node={node.arrayItemTemplate || {
                  id: `${node.id}-template`,
                  type: 'object',
                  children: []
                }}
                onChange={(template) => updateNode({ arrayItemTemplate: template })}
                level={level + 1}
                isArrayItem={true}
              />
            </div>
          )}
          
          {/* 子节点 */}
          {canHaveChildren && node.children && node.children.map((child, index) => (
            <JsonNodeEditor
              key={child.id}
              node={child}
              onChange={(updatedChild) => updateChild(index, updatedChild)}
              onDelete={() => deleteChild(index)}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// 主组件
export const JsonStructureBuilder: React.FC<JsonStructureBuilderProps> = ({
  config,
  onChange,
  fieldPath
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'template' | 'sample'>('template');
  const [isExpanded, setIsExpanded] = useState(false);

  // 应用预设模板
  const applyPreset = (presetKey: keyof typeof PRESET_TEMPLATES) => {
    const preset = PRESET_TEMPLATES[presetKey];
    onChange({
      ...config,
      rootNode: preset.structure,
      enabled: true
    });
    toast.success(`已应用 ${preset.name} 模板`);
  };

  // 生成模板字符串
  const generateTemplate = useCallback((node: JsonNode): JsonTemplateResult => {
    switch (node.type) {
      case 'template':
        return `{${node.templateVariable}}`;
      
      case 'string':
      case 'number':
      case 'boolean':
        return node.value as string | number | boolean;
      
      case 'array':
        if (node.arrayItemTemplate) {
          return [generateTemplate(node.arrayItemTemplate)];
        }
        return [];
      
      case 'object':
        const obj: { [key: string]: JsonTemplateResult } = {};
        if (node.children) {
          node.children.forEach(child => {
            if (child.key) {
              obj[child.key] = generateTemplate(child);
            }
          });
        }
        return obj;
      
      default:
        return '';
    }
  }, []);

  // 生成示例输出
  const generateSampleOutput = useCallback((node: JsonNode): JsonTemplateResult => {
    const sampleData: TemplateData = {
      role: 'user',
      content: 'Hello, how are you?',
      message: 'Hello, how are you?',
      model: 'gpt-4',
      stream: false,
      temperature: 0.7,
      apiKey: 'sk-xxx...'
    };

    const replaceTemplates = (obj: JsonTemplateResult): JsonTemplateResult => {
      if (typeof obj === 'string' && obj.startsWith('{') && obj.endsWith('}')) {
        const varName = obj.slice(1, -1);
        return sampleData[varName] || obj;
      }
      
      if (Array.isArray(obj)) {
        return obj.map(replaceTemplates);
      }
      
      if (obj && typeof obj === 'object') {
        const result: { [key: string]: JsonTemplateResult } = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = replaceTemplates(value);
        }
        return result;
      }
      
      return obj;
    };

    return replaceTemplates(generateTemplate(node));
  }, [generateTemplate]);

  return (
    <div className="space-y-2">
      {/* 主要头部控制 - 紧凑版 */}
      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={config.enabled}
            onCheckedChange={(checked) => onChange({ ...config, enabled: checked === true })}
          />
          <Label className="text-sm">启用可视化JSON结构配置</Label>
          {config.enabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 h-6 w-6 ml-2"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          )}
        </div>
        
        {config.enabled && (
          <div className="flex gap-1">
            {/* 快速模板按钮 */}
            {Object.entries(PRESET_TEMPLATES).map(([key, preset]) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                onClick={() => applyPreset(key as keyof typeof PRESET_TEMPLATES)}
                className="h-7 px-2 text-xs"
              >
                {preset.name}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="h-7 px-2"
            >
              <Eye className="h-3 w-3 mr-1" />
              预览
            </Button>
          </div>
        )}
      </div>

      {config.enabled && isExpanded && (
        <div className="space-y-2 pl-3 border-l border-gray-200">
          {/* 角色映射配置 - 极简版 */}
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-xs text-gray-600 mb-2">角色映射</div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs text-gray-600">用户</Label>
                <Input
                  value={config.roleMapping.user}
                  onChange={(e) => onChange({
                    ...config,
                    roleMapping: { ...config.roleMapping, user: e.target.value }
                  })}
                  placeholder="user"
                  className="h-6 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">助手</Label>
                <Input
                  value={config.roleMapping.assistant}
                  onChange={(e) => onChange({
                    ...config,
                    roleMapping: { ...config.roleMapping, assistant: e.target.value }
                  })}
                  placeholder="assistant"
                  className="h-6 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">系统</Label>
                <Input
                  value={config.roleMapping.system}
                  onChange={(e) => onChange({
                    ...config,
                    roleMapping: { ...config.roleMapping, system: e.target.value }
                  })}
                  placeholder="system"
                  className="h-6 text-xs"
                />
              </div>
            </div>
          </div>

          {/* JSON结构编辑器 - 表格式 */}
          <div className="bg-white border border-gray-200 rounded">
            <div className="text-xs text-gray-600 p-2 border-b bg-gray-50 flex items-center justify-between">
              <span>字段结构: {fieldPath}</span>
              <div className="text-xs text-gray-500">键名 | 类型 | 值</div>
            </div>
            <div className="p-2">
              <JsonNodeEditor
                node={config.rootNode}
                onChange={(updatedNode) => onChange({ ...config, rootNode: updatedNode })}
                level={0}
              />
            </div>
          </div>

          {/* 预览区域 - 紧凑版 */}
          {showPreview && (
            <Card className="shadow-sm">
              <CardHeader className="pb-2 pt-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs text-gray-600">预览</CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant={previewMode === 'template' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPreviewMode('template')}
                      className="h-6 px-2 text-xs"
                    >
                      <Code className="h-3 w-3 mr-1" />
                      模板
                    </Button>
                    <Button
                      variant={previewMode === 'sample' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPreviewMode('sample')}
                      className="h-6 px-2 text-xs"
                    >
                      <Settings className="h-3 w-3 mr-1" />
                      示例
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-2">
                <Textarea
                  value={JSON.stringify(
                    previewMode === 'template' 
                      ? generateTemplate(config.rootNode)
                      : generateSampleOutput(config.rootNode),
                    null,
                    2
                  )}
                  readOnly
                  rows={8}
                  className="font-mono text-xs"
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}; 