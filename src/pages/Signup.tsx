
import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Stethoscope, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

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
              Start Free Trial
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
