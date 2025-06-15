
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Zap, Shield, Globe, Mail, FolderOpen, Settings, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [flowData, setFlowData] = useState({
    flowName: '',
    emailFilter: '',
    driveFolder: '',
    fileTypes: [],
    autoRun: false,
    frequency: 'daily'
  });
  const { toast } = useToast();

  const handleSetFlow = () => {
    if (!flowData.flowName || !flowData.emailFilter || !flowData.driveFolder) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields before setting up your flow.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Flow Created Successfully!",
      description: `${flowData.flowName} is now active and will process Gmail attachments.`,
    });

    console.log('Flow Data:', flowData);
  };

  const updateFlowData = (field: string, value: any) => {
    setFlowData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                FlowState
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary" className="hidden sm:flex">
                <Globe className="w-3 h-3 mr-1" />
                Beta
              </Badge>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="create-flow">Create Flow</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            {/* Hero Section */}
            <div className="text-center space-y-6 py-12">
              <h2 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Automate Your Workflow
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                Create powerful automation flows between Gmail and Google Drive. 
                Save attachments automatically with intelligent filtering and organization.
              </p>
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3"
                onClick={() => setActiveTab('create-flow')}
              >
                <Play className="w-5 h-5 mr-2" />
                Get Started
              </Button>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="border-none shadow-lg bg-white/60 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <Mail className="w-10 h-10 text-blue-600 mb-4" />
                  <CardTitle>Smart Email Processing</CardTitle>
                  <CardDescription>
                    Automatically detect and filter emails with attachments using advanced rules and patterns.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-none shadow-lg bg-white/60 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <FolderOpen className="w-10 h-10 text-green-600 mb-4" />
                  <CardTitle>Organized Storage</CardTitle>
                  <CardDescription>
                    Save attachments to specific Google Drive folders with intelligent naming and organization.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-none shadow-lg bg-white/60 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <Shield className="w-10 h-10 text-purple-600 mb-4" />
                  <CardTitle>Secure & Reliable</CardTitle>
                  <CardDescription>
                    Built on Google Apps Script with OAuth2 authentication for maximum security and reliability.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="create-flow" className="space-y-6">
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
                    <Select onValueChange={(value) => updateFlowData('fileTypes', [value])}>
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
