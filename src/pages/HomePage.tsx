import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Stethoscope, 
  Clock, 
  FileText, 
  Mic, 
  Building2, 
  User, 
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

const HomePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-doctor-light via-white to-doctor-light/20">
      {/* Navigation Bar */}
      <nav className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b border-doctor-primary/10">
        <div className="container py-4 flex justify-between items-center max-w-6xl">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-8 w-8 text-doctor-primary" />
            <span className="font-bold text-xl text-doctor-primary">DocScribe</span>
          </div>
          <div className="space-x-4">
            <Link to="/login">
              <Button variant="outline">Log in</Button>
            </Link>
            <Link to="/signup">
              <Button>Sign up</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container py-16 md:py-24 max-w-6xl">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold text-doctor-primary leading-tight">
              AI-Powered Medical Documentation for Modern Healthcare
            </h1>
            <p className="text-lg text-gray-700">
              DocScribe uses advanced AI to convert your patient conversations into accurate medical records and prescriptions, saving you hours every day.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/signup">
                <Button size="lg" className="w-full sm:w-auto">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#pricing">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  See Pricing
                </Button>
              </a>
            </div>
          </div>
          <div className="rounded-xl overflow-hidden shadow-xl">
            <img 
              src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80" 
              alt="Doctor using DocScribe" 
              className="w-full h-auto object-cover"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-doctor-light py-16">
        <div className="container max-w-6xl">
          <h2 className="text-3xl font-bold text-center text-doctor-primary mb-12">How DocScribe Transforms Your Practice</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6 border-none shadow-md bg-white hover:shadow-lg transition-shadow">
              <div className="rounded-full bg-doctor-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                <Clock className="h-6 w-6 text-doctor-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Save 60+ Minutes Daily</h3>
              <p className="text-gray-600">Eliminate manual note-taking and documentation. Focus more on patient care, less on paperwork.</p>
            </Card>
            
            <Card className="p-6 border-none shadow-md bg-white hover:shadow-lg transition-shadow">
              <div className="rounded-full bg-doctor-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-doctor-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Accurate Documentation</h3>
              <p className="text-gray-600">Our AI captures and structures medical conversations with clinical accuracy and proper terminology.</p>
            </Card>
            
            <Card className="p-6 border-none shadow-md bg-white hover:shadow-lg transition-shadow">
              <div className="rounded-full bg-doctor-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                <Mic className="h-6 w-6 text-doctor-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Natural Conversation</h3>
              <p className="text-gray-600">Speak naturally with patients. DocScribe distinguishes between speakers and captures all relevant details.</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 md:py-24">
        <div className="container max-w-6xl">
          <h2 className="text-3xl font-bold text-center text-doctor-primary mb-4">Simple, Transparent Pricing</h2>
          <p className="text-lg text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Choose the plan that works best for your practice. All plans include unlimited consultations and our full feature set.
          </p>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Individual Plan */}
            <Card className="border-2 border-doctor-primary/20 p-8 flex flex-col">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-5 w-5 text-doctor-primary" />
                  <h3 className="text-xl font-bold">Individual Doctor</h3>
                </div>
                <div className="flex items-baseline mt-4">
                  <span className="text-4xl font-bold">$20</span>
                  <span className="text-gray-500 ml-2">/month</span>
                </div>
                <p className="text-gray-600 mt-3">Perfect for solo practitioners or small clinics.</p>
              </div>
              
              <div className="space-y-3 mb-8 flex-grow">
                <div className="flex gap-2">
                  <CheckCircle2 className="h-5 w-5 text-doctor-secondary flex-shrink-0" />
                  <span>Unlimited patient consultations</span>
                </div>
                <div className="flex gap-2">
                  <CheckCircle2 className="h-5 w-5 text-doctor-secondary flex-shrink-0" />
                  <span>AI-powered transcription</span>
                </div>
                <div className="flex gap-2">
                  <CheckCircle2 className="h-5 w-5 text-doctor-secondary flex-shrink-0" />
                  <span>Automated prescription generation</span>
                </div>
                <div className="flex gap-2">
                  <CheckCircle2 className="h-5 w-5 text-doctor-secondary flex-shrink-0" />
                  <span>Single user account</span>
                </div>
              </div>
              
              <Link to="/signup?plan=individual">
                <Button className="w-full">Get Started</Button>
              </Link>
            </Card>
            
            {/* Hospital Plan */}
            <Card className="border-2 border-doctor-accent/30 bg-gradient-to-br from-white to-doctor-light/50 p-8 flex flex-col">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-5 w-5 text-doctor-accent" />
                  <h3 className="text-xl font-bold">Hospital / Multi-Doctor</h3>
                </div>
                <div className="flex items-baseline mt-4">
                  <span className="text-4xl font-bold">Custom</span>
                </div>
                <p className="text-gray-600 mt-3">Tailored solutions for hospitals and large practices.</p>
              </div>
              
              <div className="space-y-3 mb-8 flex-grow">
                <div className="flex gap-2">
                  <CheckCircle2 className="h-5 w-5 text-doctor-secondary flex-shrink-0" />
                  <span>Everything in Individual plan</span>
                </div>
                <div className="flex gap-2">
                  <CheckCircle2 className="h-5 w-5 text-doctor-secondary flex-shrink-0" />
                  <span>Multiple user accounts</span>
                </div>
                <div className="flex gap-2">
                  <CheckCircle2 className="h-5 w-5 text-doctor-secondary flex-shrink-0" />
                  <span>Admin dashboard</span>
                </div>
                <div className="flex gap-2">
                  <CheckCircle2 className="h-5 w-5 text-doctor-secondary flex-shrink-0" />
                  <span>Priority support</span>
                </div>
                <div className="flex gap-2">
                  <CheckCircle2 className="h-5 w-5 text-doctor-secondary flex-shrink-0" />
                  <span>Custom integration options</span>
                </div>
              </div>
              
              <Button variant="secondary" className="w-full bg-doctor-accent text-white hover:bg-doctor-accent/90">
                Contact Sales
              </Button>
            </Card>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="bg-doctor-primary text-white py-16">
        <div className="container max-w-6xl text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Transform Your Practice?</h2>
          <p className="text-lg mb-8 max-w-2xl mx-auto">
            Join thousands of healthcare professionals already saving time and improving patient care with DocScribe.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup">
              <Button size="lg" variant="secondary" className="bg-white text-doctor-primary hover:bg-gray-100">
                Start Free Trial
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-doctor-primary/80 hover:text-white">
              Schedule Demo
            </Button>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="container max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Stethoscope className="h-6 w-6 text-doctor-light" />
                <span className="font-bold text-xl text-white">DocScribe</span>
              </div>
              <p className="text-sm text-gray-400">
                AI-powered medical documentation for modern healthcare professionals.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Features</a></li>
                <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
                <li><a href="#" className="hover:text-white">Case Studies</a></li>
                <li><a href="#" className="hover:text-white">Security</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">About Us</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white">HIPAA Compliance</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 text-sm text-center text-gray-500">
            © {new Date().getFullYear()} DocScribe. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
