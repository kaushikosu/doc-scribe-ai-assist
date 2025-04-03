
import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Stethoscope, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, we would authenticate the user here
    // For now, we'll just navigate to the main app
    toast({
      title: "Login successful",
      description: "Welcome back to DocScribe!",
    });
    navigate('/app');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-doctor-light via-white to-doctor-light/20 flex flex-col">
      <div className="container py-6">
        <Link to="/" className="inline-flex items-center text-doctor-primary hover:text-doctor-primary/80">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to home
        </Link>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 border-none shadow-xl">
          <div className="flex justify-center mb-6">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-8 w-8 text-doctor-primary" />
              <span className="font-bold text-xl text-doctor-primary">DocScribe</span>
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-center mb-8">Log in to your account</h1>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="doctor@example.com" 
                required 
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a href="#" className="text-sm text-doctor-primary hover:underline">
                  Forgot password?
                </a>
              </div>
              <Input 
                id="password" 
                type="password" 
                required 
              />
            </div>
            
            <Button type="submit" className="w-full">
              Log in
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <Link to="/signup" className="text-doctor-primary hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;
