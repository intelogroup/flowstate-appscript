
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Zap, Shield, Globe, Mail, FolderOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
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
              <Button asChild variant="outline" size="sm">
                <Link to="/app">Sign In</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="space-y-8">
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
                asChild
                size="lg" 
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3"
              >
                <Link to="/app">
                  <Play className="w-5 h-5 mr-2" />
                  Get Started
                </Link>
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
        </div>
      </main>
    </div>
  );
};

export default LandingPage;

