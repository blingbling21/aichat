"use client";

import { FC, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Save, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Agent, AIProvider, AIModel } from '../../../types';
import { storageService } from '../../../services/storage';
import { logService } from '../../../services/log';
import { toast } from "sonner";
import { MainLayout } from '../../../components';

// 表单验证模式
const formSchema = z.object({
  name: z.string().min(2, {
    message: "名称必须至少有2个字符",
  }),
  description: z.string().min(10, {
    message: "描述必须至少有10个字符",
  }),
  systemPrompt: z.string().min(5, {
    message: "系统提示词必须至少有5个字符",
  }),
  providerId: z.string({
    required_error: "请选择一个AI提供商",
  }),
  modelId: z.string({
    required_error: "请选择一个模型",
  }),
  keepHistory: z.boolean(),
  maxHistoryMessages: z.number().optional(),
  isStreamMode: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

const AgentEditPage: FC = () => {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const isEditing = id !== 'create';

  // 获取AI提供商列表
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);

  // 初始化表单
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      systemPrompt: "",
      providerId: "",
      modelId: "",
      keepHistory: true,
      maxHistoryMessages: 10,
      isStreamMode: true,
      temperature: 0.7,
    },
  });

  // 监听提供商ID变化，更新可用模型列表
  const watchProviderId = form.watch('providerId');
  
  // 检查当前提供商是否配置了流式响应
  const checkStreamConfig = () => {
    if (!watchProviderId) return false;
    const provider = providers.find(p => p.id === watchProviderId);
    if (!provider || !provider.customConfig) {
      return false;
    }
    return provider.customConfig.response.streamConfig?.enabled || false;
  };

  // 检查当前提供商是否配置了温度模板字段
  const checkTemperatureConfig = () => {
    if (!watchProviderId) return false;
    const provider = providers.find(p => p.id === watchProviderId);
    if (!provider || !provider.customConfig) {
      return false;
    }
    
    // 查找temperature字段配置
    const tempField = provider.customConfig.bodyFields.find(field => 
      field.path.toLowerCase().includes('temperature') && 
      field.valueType === 'template'
    );
    
    return !!tempField;
  };

  useEffect(() => {
    if (watchProviderId) {
      const provider = providers.find(p => p.id === watchProviderId);
      if (provider) {
        setAvailableModels(provider.models);
        
        // 如果当前选择的模型不在新提供商的模型列表中，重置模型选择
        const currentModelId = form.getValues('modelId');
        if (currentModelId && !provider.models.some(m => m.id === currentModelId)) {
          form.setValue('modelId', provider.defaultModelId || (provider.models.length > 0 ? provider.models[0].id : ''));
        }
      } else {
        setAvailableModels([]);
      }
    } else {
      setAvailableModels([]);
    }
  }, [watchProviderId, providers, form]);

  // 加载数据
  useEffect(() => {
    // 加载AI提供商
    const loadedProviders = storageService.getProviders();
    setProviders(loadedProviders);
    
    if (isEditing) {
      // 编辑模式：加载Agent数据
      const agent = storageService.getAgent(id);
      if (agent) {
        form.reset({
          name: agent.name,
          description: agent.description,
          systemPrompt: agent.systemPrompt,
          providerId: agent.providerId,
          modelId: agent.modelId,
          keepHistory: agent.keepHistory,
          maxHistoryMessages: agent.maxHistoryMessages || 10,
          isStreamMode: agent.isStreamMode ?? true,
          temperature: agent.temperature ?? 0.7,
        });
      } else {
        toast.error("找不到要编辑的Agent");
        router.push('/agents');
      }
    } else {
      // 创建模式：使用默认值
      if (loadedProviders.length > 0) {
        form.setValue('providerId', loadedProviders[0].id);
        if (loadedProviders[0].models.length > 0) {
          form.setValue('modelId', loadedProviders[0].defaultModelId || loadedProviders[0].models[0].id);
        }
      }
    }
  }, [isEditing, id, form, router]);

  // 提交表单
  const onSubmit = (values: z.infer<typeof formSchema>) => {
    try {
      const newAgent: Agent = {
        id: isEditing ? id : Date.now().toString(),
        name: values.name,
        description: values.description,
        systemPrompt: values.systemPrompt,
        providerId: values.providerId,
        modelId: values.modelId,
        keepHistory: values.keepHistory,
        maxHistoryMessages: values.maxHistoryMessages,
        isStreamMode: values.isStreamMode,
        temperature: values.temperature,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      storageService.saveAgent(newAgent);
      
      toast.success(isEditing ? "Agent已更新" : "Agent已创建");
      logService.info(isEditing ? `已更新Agent: ${newAgent.name}` : `已创建Agent: ${newAgent.name}`);
      
      router.push('/agents');
    } catch (error) {
      toast.error("保存失败");
      logService.error(`保存Agent失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 max-w-3xl">
        <div className="flex items-center mb-6">
          <Button 
            variant="outline" 
            size="sm"
            className="mr-2"
            onClick={() => router.push('/agents')}
          >
            <ArrowLeft size={16} className="mr-1" />
            返回
          </Button>
          <h1 className="text-2xl font-bold">{isEditing ? '编辑' : '创建'}AI代理</h1>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>名称</FormLabel>
                  <FormControl>
                    <Input placeholder="例如: 论文助手、代码审查者" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>描述</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="描述这个AI代理的功能和用途..." 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="systemPrompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>系统提示词</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="定义AI代理的行为和能力的系统提示词..." 
                      className="min-h-[150px]"
                      {...field} 
                    />
                  </FormControl>
                  <div className="text-xs text-gray-500 mt-1">
                    系统提示词决定了AI代理的&quot;个性&quot;和能力范围，它会影响所有对话。
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="providerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>AI提供商</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择AI提供商" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {providers.map(provider => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="modelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>AI模型</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                      disabled={availableModels.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择AI模型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableModels.map(model => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="keepHistory"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>保留对话历史</FormLabel>
                    <p className="text-sm text-gray-500">
                      保留对话历史使AI代理能够记住之前的交流内容
                    </p>
                  </div>
                </FormItem>
              )}
            />
            
            {form.watch("keepHistory") && (
              <FormField
                control={form.control}
                name="maxHistoryMessages"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>最大历史消息数</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={e => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <div className="text-xs text-gray-500 mt-1">
                      限制传递给模型的历史消息数量，较小的值可以降低Token使用量
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            {/* 流式模式设置 */}
            <FormField
              control={form.control}
              name="isStreamMode"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>启用流式输出</FormLabel>
                    <p className="text-sm text-gray-500">
                      流式输出能实时显示AI回复内容，提供更好的交互体验
                      {!checkStreamConfig() && field.value && 
                        <span className="text-red-500 block">（注意：当前提供商未配置流式响应解析）</span>
                      }
                    </p>
                  </div>
                </FormItem>
              )}
            />
            
            {/* 温度设置 */}
            {checkTemperatureConfig() && (
              <FormField
                control={form.control}
                name="temperature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>温度设置</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        min="0"
                        max="2"
                        value={field.value || 0}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '') {
                            field.onChange(0);
                          } else {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue)) {
                              // 保留最多3位小数
                              field.onChange(Math.round(numValue * 1000) / 1000);
                            }
                          }
                        }}
                      />
                    </FormControl>
                    <div className="text-xs text-gray-500 mt-1">
                      控制AI回复的随机性和创造性 (0.0-2.0)。较低值更保守，较高值更有创意。支持精确到小数点后三位，如0.733
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <Button type="submit" className="w-full">
              <Save size={16} className="mr-2" />
              {isEditing ? '保存修改' : '创建AI代理'}
            </Button>
          </form>
        </Form>
      </div>
    </MainLayout>
  );
};

export default AgentEditPage; 