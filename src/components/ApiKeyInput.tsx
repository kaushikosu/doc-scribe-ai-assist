
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Key, Save, Check, Globe } from 'lucide-react';
import { toast } from '@/lib/toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ApiKeyInputProps {
  onApiKeySet: (apiKey: string, region?: string) => void;
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ onApiKeySet }) => {
  const [activeProvider, setActiveProvider] = useState('azure');
  const [azureKey, setAzureKey] = useState<string>('');
  const [azureRegion, setAzureRegion] = useState<string>('');
  const [googleKey, setGoogleKey] = useState<string>('');
  const [savedConfig, setSavedConfig] = useState<{
    provider: string;
    key: string;
    region?: string;
  } | null>(null);
  
  // Check for saved API key on component mount
  useEffect(() => {
    const savedProvider = localStorage.getItem('speechProvider') || 'azure';
    const savedAzureKey = localStorage.getItem('azureSpeechApiKey');
    const savedAzureRegion = localStorage.getItem('azureSpeechRegion');
    const savedGoogleKey = localStorage.getItem('googleSpeechApiKey');
    
    setActiveProvider(savedProvider);
    
    if (savedProvider === 'azure' && savedAzureKey && savedAzureRegion) {
      setSavedConfig({
        provider: 'azure',
        key: savedAzureKey,
        region: savedAzureRegion
      });
      onApiKeySet(savedAzureKey, savedAzureRegion);
    } else if (savedProvider === 'google' && savedGoogleKey) {
      setSavedConfig({
        provider: 'google',
        key: savedGoogleKey
      });
      onApiKeySet(savedGoogleKey);
    }
  }, [onApiKeySet]);
  
  const handleSaveApiKey = () => {
    if (activeProvider === 'azure') {
      if (!azureKey.trim()) {
        toast.error('Please enter a valid Azure API key');
        return;
      }
      
      if (!azureRegion.trim()) {
        toast.error('Please enter a valid Azure region');
        return;
      }
      
      // Save Azure config to localStorage
      localStorage.setItem('speechProvider', 'azure');
      localStorage.setItem('azureSpeechApiKey', azureKey);
      localStorage.setItem('azureSpeechRegion', azureRegion);
      setSavedConfig({
        provider: 'azure',
        key: azureKey,
        region: azureRegion
      });
      onApiKeySet(azureKey, azureRegion);
      toast.success('Azure Speech API key and region saved');
    } else {
      if (!googleKey.trim()) {
        toast.error('Please enter a valid Google API key');
        return;
      }
      
      // Save Google config to localStorage
      localStorage.setItem('speechProvider', 'google');
      localStorage.setItem('googleSpeechApiKey', googleKey);
      setSavedConfig({
        provider: 'google',
        key: googleKey
      });
      onApiKeySet(googleKey);
      toast.success('Google Cloud Speech API key saved');
    }
  };
  
  // If we already have a saved key, show a simplified view
  if (savedConfig) {
    return (
      <Card className="bg-doctor-light/50 border-doctor-primary/20">
        <CardContent className="pt-4 pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              <p className="text-sm text-muted-foreground">
                {savedConfig.provider === 'azure' 
                  ? `Azure Speech API configured (${savedConfig.region})`
                  : 'Google Cloud Speech API configured'}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSavedConfig(null)}
              className="h-8"
            >
              Change
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="border-doctor-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Key className="h-5 w-5" />
          Speech Recognition API
        </CardTitle>
        <CardDescription>
          Configure your speech recognition provider
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs 
          defaultValue={activeProvider} 
          value={activeProvider}
          onValueChange={setActiveProvider}
          className="w-full"
        >
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="azure" className="flex items-center gap-1">
              <Globe className="h-4 w-4" />
              Azure
            </TabsTrigger>
            <TabsTrigger value="google" className="flex items-center gap-1">
              <Globe className="h-4 w-4" />
              Google
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="azure" className="space-y-4">
            <div className="space-y-2">
              <Input 
                type="password"
                placeholder="Enter your Azure Speech API key"
                value={azureKey}
                onChange={(e) => setAzureKey(e.target.value)}
                className="flex-1"
              />
              <Input 
                placeholder="Enter your Azure region (e.g., eastus, westus)"
                value={azureRegion}
                onChange={(e) => setAzureRegion(e.target.value)}
                className="flex-1"
              />
            </div>
          </TabsContent>
          
          <TabsContent value="google">
            <Input 
              type="password"
              placeholder="Enter your Google Cloud Speech API key"
              value={googleKey}
              onChange={(e) => setGoogleKey(e.target.value)}
              className="flex-1"
            />
          </TabsContent>
          
          <div className="mt-4">
            <Button onClick={handleSaveApiKey} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Save Configuration
            </Button>
          </div>
        </Tabs>
      </CardContent>
      <CardFooter className="pt-0 text-xs text-muted-foreground">
        {activeProvider === 'azure' 
          ? 'Get your API key from the Azure Portal under Cognitive Services'
          : 'You can get your API key from the Google Cloud Console'}
      </CardFooter>
    </Card>
  );
};

export default ApiKeyInput;
