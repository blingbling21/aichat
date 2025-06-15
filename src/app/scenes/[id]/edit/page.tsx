"use client";

import { FC, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import * as z from "zod";
import { Save, ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Agent, Scene } from '../../../types';
import { storageService } from '../../../services';
import { logService } from '../../../services/log';
import { toast } from "sonner";
import { MainLayout } from '../../../components';

// 表单验证模式
const participantSchema = z.object({
  id: z.string().optional(),
  agentId: z.string({
    required_error: "请选择一个Agent",
  }),
  role: z.string().min(1, {
    message: "请输入角色名称",
  }),
  contextPrompt: z.string().min(10, {
    message: "上下文提示词至少需要10个字符",
  }),
  interactionRules: z.string().optional(),
  order: z.number().optional(),
});

const formSchema = z.object({
  name: z.string().min(2, {
    message: "名称必须至少有2个字符",
  }),
  description: z.string().min(10, {
    message: "描述必须至少有10个字符",
  }),
  scenarioPrompt: z.string().min(10, {
    message: "场景背景提示词必须至少有10个字符",
  }),
  participants: z.array(participantSchema).min(1, {
    message: "至少需要添加一个参与者",
  }),
});

interface SceneEditPageProps {
  params?: { id: string };
  isCreateMode?: boolean;
}

const SceneEditPage: FC<SceneEditPageProps> = ({ params, isCreateMode = false }) => {
  const router = useRouter();
  const routeParams = useParams();
  const id = params?.id || routeParams.id as string || 'create';
  const isEditing = !isCreateMode && id !== 'create';

  // 可选的Agent列表
  const [agents, setAgents] = useState<Agent[]>([]);

  // 初始化表单
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      scenarioPrompt: "",
      participants: [],
    },
  });

  // 使用useFieldArray管理参与者数组
  const { fields, append, remove, move, update } = useFieldArray({
    control: form.control,
    name: "participants",
  });

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      // 加载所有可用的Agent
      const loadedAgents = await storageService.getAgents();
      setAgents(loadedAgents);
      
      if (isEditing) {
        // 编辑模式：加载场景数据
        const scene = await storageService.getScene(id);
        if (scene) {
          form.reset({
            name: scene.name,
            description: scene.description,
            scenarioPrompt: scene.scenarioPrompt,
            participants: scene.participants,
          });
        } else {
          toast.error("找不到要编辑的场景");
          router.push('/scenes');
        }
      } else {
        // 创建模式：使用默认值
        if (loadedAgents.length > 0) {
          // 添加一个默认参与者
          append({
            id: Date.now().toString(),
            agentId: loadedAgents[0].id,
            role: "",
            contextPrompt: "",
            interactionRules: "",
            order: 0,
          });
        }
      }
    };
    
    loadData();
  }, [isEditing, id, form, router, append]);

  // 添加参与者
  const handleAddParticipant = () => {
    if (agents.length === 0) {
      toast.error("没有可用的Agent，请先创建Agent");
      return;
    }
    
    append({
      id: Date.now().toString(),
      agentId: agents[0].id,
      role: "",
      contextPrompt: "",
      interactionRules: "",
      order: fields.length,
    });
  };

  // 上移参与者
  const handleMoveUp = (index: number) => {
    if (index > 0) {
      move(index, index - 1);
      
      // 更新排序
      const participants = form.getValues("participants");
      participants.forEach((p, i) => {
        update(i, { ...p, order: i });
      });
    }
  };

  // 下移参与者
  const handleMoveDown = (index: number) => {
    if (index < fields.length - 1) {
      move(index, index + 1);
      
      // 更新排序
      const participants = form.getValues("participants");
      participants.forEach((p, i) => {
        update(i, { ...p, order: i });
      });
    }
  };

  // 提交表单
  const onSubmit = (values: z.infer<typeof formSchema>) => {
    try {
      // 更新参与者排序
      const participants = values.participants.map((p, index) => ({
        ...p,
        id: p.id || Date.now().toString() + index,
        order: index,
      }));
      
      const newScene: Scene = {
        id: isEditing ? id : Date.now().toString(),
        name: values.name,
        description: values.description,
        scenarioPrompt: values.scenarioPrompt,
        participants,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      storageService.saveScene(newScene);
      
      toast.success(isEditing ? "场景已更新" : "场景已创建");
      logService.info(isEditing ? `已更新场景: ${newScene.name}` : `已创建场景: ${newScene.name}`);
      
      router.push('/scenes');
    } catch (error) {
      toast.error("保存失败");
      logService.error(`保存场景失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };


  return (
    <MainLayout>
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center mb-6">
          <Button 
            variant="outline" 
            size="sm"
            className="mr-2"
            onClick={() => router.push('/scenes')}
          >
            <ArrowLeft size={16} className="mr-1" />
            返回
          </Button>
          <h1 className="text-2xl font-bold">{isEditing ? '编辑' : '创建'}AI交互场景</h1>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>场景名称</FormLabel>
                    <FormControl>
                      <Input placeholder="例如: 产品策划会议、客户服务模拟" {...field} />
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
                    <FormLabel>场景描述</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="描述这个场景的目的和用途..." 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="scenarioPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>场景背景提示词</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="描述场景的背景、环境和上下文..." 
                        className="min-h-[150px]"
                        {...field} 
                      />
                    </FormControl>
                    <div className="text-xs text-gray-500 mt-1">
                      场景背景提示词会作为所有参与者的共享上下文，用于定义交互的环境和背景。
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">场景参与者</h2>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleAddParticipant}
                >
                  <Plus size={16} className="mr-1" />
                  添加参与者
                </Button>
              </div>
              
              {fields.length === 0 ? (
                <div className="text-center p-6 bg-muted/30 rounded-lg">
                  <p className="text-muted-foreground mb-2">还没有添加参与者</p>
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={handleAddParticipant}
                  >
                    <Plus size={16} className="mr-1" />
                    添加第一个参与者
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {fields.map((field, index) => (
                    <Card key={field.id} className="relative">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex justify-between items-center">
                          <span>参与者 #{index + 1}</span>
                          <div className="flex space-x-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMoveUp(index)}
                              disabled={index === 0}
                            >
                              <ArrowUp size={14} />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMoveDown(index)}
                              disabled={index === fields.length - 1}
                            >
                              <ArrowDown size={14} />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => remove(index)}
                              className="text-destructive"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name={`participants.${index}.agentId`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>选择Agent</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  value={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="选择Agent" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {agents.map(agent => (
                                      <SelectItem key={agent.id} value={agent.id}>
                                        {agent.name}
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
                            name={`participants.${index}.role`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>角色名称</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="例如: 产品经理、开发工程师" 
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <FormField
                          control={form.control}
                          name={`participants.${index}.contextPrompt`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>角色上下文提示词</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="描述这个角色在场景中的定位、知识背景和行为特点..." 
                                  className="min-h-[100px]"
                                  {...field} 
                                />
                              </FormControl>
                              <div className="text-xs text-gray-500 mt-1">
                                这将与Agent的系统提示词合并，定制其在此场景中的行为。
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name={`participants.${index}.interactionRules`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>交互规则</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="定义这个角色与其他角色交互的规则和方式，可选..." 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
            
            <Button type="submit" className="w-full">
              <Save size={16} className="mr-2" />
              {isEditing ? '保存修改' : '创建场景'}
            </Button>
          </form>
        </Form>
      </div>
    </MainLayout>
  );
};

export default SceneEditPage; 