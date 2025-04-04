
import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Stethoscope, ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Separator } from '@/components/ui/separator';
import { signInWithGoogle } from '@/lib/firebase';

const Signup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const searchParams = new URLSearchParams(location.search);
  const initialPlan = searchParams.get('plan') || 'individual';
  
  const [plan, setPlan] = useState(initialPlan);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, we would register the user here
    toast({
      title: "Account created!",
      description: "Welcome to DocScribe. Your free trial has been activated.",
    });
    navigate('/app');
  };

  const handleGoogleSignUp = async () => {
    try {
      const user = await signInWithGoogle();
      
      toast({
        title: "Account created with Google!",
        description: `Welcome to DocScribe, ${user.displayName || 'user'}! Your free trial has been activated.`,
      });
      
      navigate('/app');
    } catch (error) {
      toast({
        title: "Sign up failed",
        description: "Could not sign up with Google. Please try again.",
        variant: "destructive",
      });
      console.error(error);
    }
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
          
          <h1 className="text-2xl font-bold text-center mb-8">Create your account</h1>
          
          <Button 
            onClick={handleGoogleSignUp} 
            variant="outline" 
            className="w-full mb-4 border-gray-300 hover:bg-gray-50"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" className="mr-2">
              <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
              </g>
            </svg>
            Sign up with Google
          </Button>
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-2 text-sm text-muted-foreground">
                or sign up with email
              </span>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input 
                id="name" 
                type="text" 
                placeholder="Dr. John Smith" 
                required 
              />
            </div>
            
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
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                required 
              />
            </div>
            
            <div className="space-y-2">
              <Label>Choose your plan</Label>
              <RadioGroup defaultValue={plan} onValueChange={setPlan} className="flex flex-col gap-2">
                <div className="flex items-center space-x-2 border rounded-md p-3 cursor-pointer hover:bg-gray-50">
                  <RadioGroupItem value="individual" id="individual" />
                  <Label htmlFor="individual" className="flex-1 cursor-pointer">
                    <div className="font-medium">Individual Doctor</div>
                    <div className="text-sm text-gray-500">$20/month after free trial</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-md p-3 cursor-pointer hover:bg-gray-50">
                  <RadioGroupItem value="hospital" id="hospital" />
                  <Label htmlFor="hospital" className="flex-1 cursor-pointer">
                    <div className="font-medium">Hospital / Multi-Doctor</div>
                    <div className="text-sm text-gray-500">Contact sales for pricing</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            <div className="flex items-start space-x-2">
              <div className="flex items-center h-5">
                <input
                  id="terms"
                  type="checkbox"
                  required
                  className="h-4 w-4 border border-gray-300 rounded"
                />
              </div>
              <Label htmlFor="terms" className="text-sm">
                I agree to the <a href="#" className="text-doctor-primary hover:underline">Terms of Service</a> and <a href="#" className="text-doctor-primary hover:underline">Privacy Policy</a>
              </Label>
            </div>
            
            <Button type="submit" className="w-full">
              <Mail className="h-4 w-4 mr-2" />
              Sign Up with Email
            </Button>
          </form>
          
          <div className="mt-6">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <CheckCircle2 className="h-4 w-4 text-doctor-secondary" />
              <span>14-day free trial, no credit card required</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle2 className="h-4 w-4 text-doctor-secondary" />
              <span>Cancel anytime, no questions asked</span>
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-doctor-primary hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Signup;
