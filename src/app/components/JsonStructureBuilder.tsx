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
  const [expanded, setExpanded] = useState(level < 2); // 默认展开前两层

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

  // 渲染节点类型选择器
  const renderTypeSelector = () => (
    <Select
      value={node.type}
      onValueChange={(value: JsonNode['type']) => updateNode({ type: value })}
    >
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="object">对象</SelectItem>
        <SelectItem value="array">数组</SelectItem>
        <SelectItem value="string">字符串</SelectItem>
        <SelectItem value="number">数字</SelectItem>
        <SelectItem value="boolean">布尔值</SelectItem>
        <SelectItem value="template">模板变量</SelectItem>
      </SelectContent>
    </Select>
  );

  // 渲染值编辑器
  const renderValueEditor = () => {
    switch (node.type) {
      case 'template':
        return (
          <Select
            value={node.templateVariable || ''}
            onValueChange={(value) => updateNode({ templateVariable: value })}
          >
            <SelectTrigger>
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
          />
        );
      
      case 'number':
        return (
          <Input
            type="number"
            value={node.value?.toString() || ''}
            onChange={(e) => updateNode({ value: parseFloat(e.target.value) || 0 })}
            placeholder="数字值"
          />
        );
      
      case 'boolean':
        return (
          <Select
            value={node.value?.toString() || 'false'}
            onValueChange={(value) => updateNode({ value: value === 'true' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">true</SelectItem>
              <SelectItem value="false">false</SelectItem>
            </SelectContent>
          </Select>
        );
      
      default:
        return null;
    }
  };

  const canHaveChildren = node.type === 'object';
  const isArray = node.type === 'array';

  return (
    <Card className={`ml-${level * 4} mb-2`}>
      <CardHeader className="p-3">
        <div className="flex items-center gap-2">
          {(canHaveChildren || isArray) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="p-1 h-6 w-6"
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          )}
          
          <div className="flex-1 grid grid-cols-12 gap-2 items-center">
            {!isArrayItem && (
              <div className="col-span-3">
                <Input
                  value={node.key || ''}
                  onChange={(e) => updateNode({ key: e.target.value })}
                  placeholder="键名"
                  className="h-8"
                />
              </div>
            )}
            
            <div className={isArrayItem ? "col-span-3" : "col-span-2"}>
              {renderTypeSelector()}
            </div>
            
            <div className={isArrayItem ? "col-span-6" : "col-span-5"}>
              {renderValueEditor()}
            </div>
            
            <div className="col-span-2 flex gap-1">
              {canHaveChildren && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addChild}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              
              {onDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onDelete}
                  className="h-8 w-8 p-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
        
        {/* 描述输入 */}
        <Input
          value={node.description || ''}
          onChange={(e) => updateNode({ description: e.target.value })}
          placeholder="节点描述"
          className="h-8 text-sm"
        />
      </CardHeader>
      
      {expanded && (
        <CardContent className="p-3 pt-0">
          {/* 数组项模板编辑 */}
          {isArray && (
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <Label className="text-sm font-medium mb-2 block">数组项模板:</Label>
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
        </CardContent>
      )}
    </Card>
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
    <div className="space-y-4">
      {/* 头部控制 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={config.enabled}
            onCheckedChange={(checked) => onChange({ ...config, enabled: checked === true })}
          />
          <Label>启用可视化JSON结构配置</Label>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="h-4 w-4 mr-1" />
            预览
          </Button>
        </div>
      </div>

      {config.enabled && (
        <>
          {/* 预设模板 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">快速模板</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              {Object.entries(PRESET_TEMPLATES).map(([key, preset]) => (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(key as keyof typeof PRESET_TEMPLATES)}
                >
                  {preset.name}
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* 角色映射配置 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">角色映射</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
              <div>
                <Label>用户角色值</Label>
                <Input
                  value={config.roleMapping.user}
                  onChange={(e) => onChange({
                    ...config,
                    roleMapping: { ...config.roleMapping, user: e.target.value }
                  })}
                  placeholder="user"
                />
              </div>
              <div>
                <Label>助手角色值</Label>
                <Input
                  value={config.roleMapping.assistant}
                  onChange={(e) => onChange({
                    ...config,
                    roleMapping: { ...config.roleMapping, assistant: e.target.value }
                  })}
                  placeholder="assistant"
                />
              </div>
              <div>
                <Label>系统角色值</Label>
                <Input
                  value={config.roleMapping.system}
                  onChange={(e) => onChange({
                    ...config,
                    roleMapping: { ...config.roleMapping, system: e.target.value }
                  })}
                  placeholder="system"
                />
              </div>
            </CardContent>
          </Card>

          {/* JSON结构编辑器 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                字段结构: {fieldPath}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <JsonNodeEditor
                node={config.rootNode}
                onChange={(updatedNode) => onChange({ ...config, rootNode: updatedNode })}
                level={0}
              />
            </CardContent>
          </Card>

          {/* 预览区域 */}
          {showPreview && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">预览</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant={previewMode === 'template' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPreviewMode('template')}
                    >
                      <Code className="h-4 w-4 mr-1" />
                      模板
                    </Button>
                    <Button
                      variant={previewMode === 'sample' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPreviewMode('sample')}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      示例
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={JSON.stringify(
                    previewMode === 'template' 
                      ? generateTemplate(config.rootNode)
                      : generateSampleOutput(config.rootNode),
                    null,
                    2
                  )}
                  readOnly
                  rows={12}
                  className="font-mono text-sm"
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}; 