
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Key, Save, Check } from 'lucide-react';
import { toast } from '@/lib/toast';

interface ApiKeyInputProps {
  onApiKeySet: (apiKey: string) => void;
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ onApiKeySet }) => {
  const [apiKey, setApiKey] = useState<string>('');
  const [savedKey, setSavedKey] = useState<string | null>(null);
  
  // Check for saved API key on component mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('googleSpeechApiKey');
    if (savedApiKey) {
      setSavedKey(savedApiKey);
      onApiKeySet(savedApiKey);
    }
  }, [onApiKeySet]);
  
  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      toast.error('Please enter a valid API key');
      return;
    }
    
    // Save API key to localStorage
    localStorage.setItem('googleSpeechApiKey', apiKey);
    setSavedKey(apiKey);
    onApiKeySet(apiKey);
    toast.success('Google Cloud Speech API key saved');
  };
  
  // If we already have a saved key, show a simplified view
  if (savedKey) {
    return (
      <Card className="bg-doctor-light/50 border-doctor-primary/20">
        <CardContent className="pt-4 pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              <p className="text-sm text-muted-foreground">Google Cloud Speech API configured</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSavedKey(null)}
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
          Google Cloud Speech API
        </CardTitle>
        <CardDescription>
          Enter your Google Cloud API key to enable enhanced speech recognition
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Input 
            type="password"
            placeholder="Enter your Google Cloud Speech API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleSaveApiKey}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </CardContent>
      <CardFooter className="pt-0 text-xs text-muted-foreground">
        You can get your API key from the Google Cloud Console
      </CardFooter>
    </Card>
  );
};

export default ApiKeyInput;
