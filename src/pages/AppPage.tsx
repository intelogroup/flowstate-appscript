
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Zap, Globe, Settings, CheckCircle, LogOut, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const AppPage = () => {
  const [flowData, setFlowData] = useState({
    flowName: '',
    emailFilter: '',
    driveFolder: '',
    fileTypes: [] as string[],
    autoRun: false,
    frequency: 'daily'
  });
  const { toast } = useToast();
  const { user, signOut } = useAuth();

  const handleSetFlow = async () => {
    if (!flowData.flowName || !flowData.emailFilter || !flowData.driveFolder) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields before setting up your flow.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('user_configurations')
        .insert({
          user_id: user?.id,
          flow_name: flowData.flowName,
          email_filter: flowData.emailFilter,
          drive_folder: flowData.driveFolder,
          file_types: flowData.fileTypes,
          auto_run: flowData.autoRun,
          frequency: flowData.frequency
        });

      if (error) {
        toast({
          title: "Error saving flow",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Flow Created Successfully!",
          description: `${flowData.flowName} is now active and will process Gmail attachments.`,
        });

        // Reset form
        setFlowData({
          flowName: '',
          emailFilter: '',
          driveFolder: '',
          fileTypes: [],
          autoRun: false,
          frequency: 'daily'
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    }

    console.log('Flow Data:', flowData);
  };

  const updateFlowData = (field: string, value: any) => {
    setFlowData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                FlowState
              </h1>
            </Link>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary" className="hidden sm:flex">
                <Globe className="w-3 h-3 mr-1" />
                Beta
              </Badge>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <User className="w-4 h-4" />
                <span>{user?.email}</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="space-y-6">
            <div className="max-w-2xl mx-auto">
              <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl flex items-center justify-center">
                    <Zap className="w-6 h-6 mr-2 text-blue-600" />
                    Create New Flow
                  </CardTitle>
                  <CardDescription>
                    Set up an automated workflow to save Gmail attachments to Google Drive
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Flow Name */}
                  <div className="space-y-2">
                    <Label htmlFor="flowName">Flow Name *</Label>
                    <Input
                      id="flowName"
                      placeholder="e.g., Invoice Attachments"
                      value={flowData.flowName}
                      onChange={(e) => updateFlowData('flowName', e.target.value)}
                      className="border-gray-200 focus:border-blue-500"
                    />
                  </div>

                  {/* Email Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="emailFilter">Email Filter *</Label>
                    <Textarea
                      id="emailFilter"
                      placeholder="e.g., from:invoices@company.com has:attachment"
                      value={flowData.emailFilter}
                      onChange={(e) => updateFlowData('emailFilter', e.target.value)}
                      className="border-gray-200 focus:border-blue-500 resize-none"
                      rows={3}
                    />
                    <p className="text-sm text-gray-500">
                      Use Gmail search syntax to define which emails to process
                    </p>
                  </div>

                  {/* Drive Folder */}
                  <div className="space-y-2">
                    <Label htmlFor="driveFolder">Google Drive Folder *</Label>
                    <Input
                      id="driveFolder"
                      placeholder="e.g., /Business/Invoices"
                      value={flowData.driveFolder}
                      onChange={(e) => updateFlowData('driveFolder', e.target.value)}
                      className="border-gray-200 focus:border-blue-500"
                    />
                  </div>

                  {/* File Types */}
                  <div className="space-y-2">
                    <Label>File Types to Process</Label>
                    <Select onValueChange={(value) => updateFlowData('fileTypes', value === 'all' ? [] : [value])}>
                      <SelectTrigger className="border-gray-200 focus:border-blue-500">
                        <SelectValue placeholder="Select file types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All file types</SelectItem>
                        <SelectItem value="pdf">PDF only</SelectItem>
                        <SelectItem value="images">Images only</SelectItem>
                        <SelectItem value="documents">Documents only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Auto Run Toggle */}
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="space-y-1">
                      <Label>Auto-run Flow</Label>
                      <p className="text-sm text-gray-500">
                        Automatically process new emails
                      </p>
                    </div>
                    <Switch
                      checked={flowData.autoRun}
                      onCheckedChange={(checked) => updateFlowData('autoRun', checked)}
                    />
                  </div>

                  {/* Frequency */}
                  {flowData.autoRun && (
                    <div className="space-y-2">
                      <Label>Run Frequency</Label>
                      <Select 
                        value={flowData.frequency}
                        onValueChange={(value) => updateFlowData('frequency', value)}
                      >
                        <SelectTrigger className="border-gray-200 focus:border-blue-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hourly">Every hour</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Set Flow Button */}
                  <Button 
                    onClick={handleSetFlow}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3"
                    size="lg"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Set Flow
                  </Button>

                  <p className="text-center text-sm text-gray-500">
                    Your flow will be securely stored and executed using Google Apps Script
                  </p>
                </CardContent>
              </Card>
            </div>
        </div>
      </main>
    </div>
  );
};

export default AppPage;
