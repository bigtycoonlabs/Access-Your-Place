
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Calendar, User, CheckCircle, Clock, AlertCircle, Palette, Sofa, Monitor, Zap, Users, Megaphone } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props { propertyId: string; investorId: string; propertyTitle: string; }

const CATEGORIES = [
  { value: 'design', label: 'Design', icon: Palette, color: 'bg-purple-500' },
  { value: 'furniture', label: 'Furniture', icon: Sofa, color: 'bg-orange-500' },
  { value: 'software', label: 'Software', icon: Monitor, color: 'bg-blue-500' },
  { value: 'utilities', label: 'Utilities', icon: Zap, color: 'bg-yellow-500' },
  { value: 'vendors', label: 'Vendors', icon: Users, color: 'bg-pink-500' },
  { value: 'marketing', label: 'Marketing', icon: Megaphone, color: 'bg-green-500' }
];

export function SetupTasksManager({ propertyId, investorId, propertyTitle }: Props) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const { toast } = useToast();

  useEffect(() => { fetchTasks(); }, [propertyId]);

  const fetchTasks = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke('manage-setup-tasks', { body: { action: 'list', property_id: propertyId } });
    setTasks(data?.tasks || []);
    setLoading(false);
  };

  const createDefaultTasks = async () => {
    setLoading(true);
    await supabase.functions.invoke('manage-setup-tasks', { body: { action: 'create_default_tasks', property_id: propertyId, investor_id: investorId } });
    toast({ title: 'Tasks created!' });
    fetchTasks();
  };

  const toggleComplete = async (task: any) => {
    if (task.status === 'completed') {
      await supabase.functions.invoke('manage-setup-tasks', { body: { action: 'update', task_id: task.id, updates: { status: 'pending', completed_at: null } } });
    } else {
      await supabase.functions.invoke('manage-setup-tasks', { body: { action: 'complete', task_id: task.id, completed_by: 'Staff' } });
    }
    fetchTasks();
  };

  const updateTask = async (taskId: string, updates: any) => {
    await supabase.functions.invoke('manage-setup-tasks', { body: { action: 'update', task_id: taskId, updates } });
    fetchTasks();
  };

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.category === filter);
  const progress = CATEGORIES.map(c => {
    const catTasks = tasks.filter(t => t.category === c.value);
    return { ...c, total: catTasks.length, completed: catTasks.filter(t => t.status === 'completed').length };
  });

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  if (tasks.length === 0) {
    return (
      <Card className="p-8 text-center">
        <h3 className="font-semibold mb-2">No Setup Tasks Yet</h3>
        <p className="text-gray-500 mb-4">Create default tasks for this acquisition</p>
        <Button onClick={createDefaultTasks}><Plus className="w-4 h-4 mr-2" />Create Default Tasks</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-6 gap-2">
        {progress.map(p => {
          const Icon = p.icon;
          const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
          return (
            <Card key={p.value} className={`p-3 cursor-pointer ${filter === p.value ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setFilter(filter === p.value ? 'all' : p.value)}>
              <div className="flex items-center gap-2 mb-2"><div className={`w-6 h-6 rounded flex items-center justify-center ${p.color}`}><Icon className="w-3 h-3 text-white" /></div><span className="text-xs font-medium">{p.label}</span></div>
              <div className="h-1.5 bg-gray-200 rounded"><div className={`h-full rounded ${p.color}`} style={{ width: `${pct}%` }} /></div>
              <p className="text-xs text-gray-500 mt-1">{p.completed}/{p.total}</p>
            </Card>
          );
        })}
      </div>

      <div className="space-y-2">
        {filtered.map(task => {
          const cat = CATEGORIES.find(c => c.value === task.category);
          const Icon = cat?.icon || Clock;
          return (
            <Card key={task.id} className={`p-3 ${task.status === 'completed' ? 'bg-green-50' : ''}`}>
              <div className="flex items-center gap-3">
                <Checkbox checked={task.status === 'completed'} onCheckedChange={() => toggleComplete(task)} />
                <div className={`w-8 h-8 rounded flex items-center justify-center ${cat?.color || 'bg-gray-400'}`}><Icon className="w-4 h-4 text-white" /></div>
                <div className="flex-1">
                  <p className={`font-medium ${task.status === 'completed' ? 'line-through text-gray-400' : ''}`}>{task.task_name}</p>
                  <p className="text-xs text-gray-500">{task.description}</p>
                </div>
                <Input type="date" className="w-36" value={task.due_date || ''} onChange={e => updateTask(task.id, { due_date: e.target.value })} />
                <Input placeholder="Assigned to" className="w-32" value={task.assigned_to || ''} onChange={e => updateTask(task.id, { assigned_to: e.target.value })} />
                {task.status === 'completed' && <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Done</Badge>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
