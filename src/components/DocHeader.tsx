import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Stethoscope, FileText, Building, LogOut, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { toast } from '@/lib/toast';
import { useAuth } from '@/hooks/useAuth';
import { signOutUser } from '@/lib/firebase';
import { useNavigate } from 'react-router-dom';
interface DocHeaderProps {
  patientInfo: {
    name: string;
    time: string;
  };
}

const DocHeader: React.FC<DocHeaderProps> = ({ patientInfo }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const hospitalName = "Arogya General Hospital";
  
  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error("Error in handleLogout:", error);
    }
  };

  // Get user display information with fallbacks
  const userName = currentUser?.displayName || "Doctor";
  const userEmail = currentUser?.email || "";
  const userInitials = userName ? userName.split(' ').map(n => n[0]).join('').toUpperCase() : "DR";
  const photoURL = currentUser?.photoURL || "";

  return (
    <div className="flex flex-col gap-2 mb-6">
      <Card className="bg-gradient-to-r from-doctor-primary to-doctor-primary/80 text-white w-full shadow-md">
        <CardContent className="p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-8 w-8" />
              <FileText className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">DocScribe AI Assistant</h1>
              <p className="text-doctor-primary-foreground/80">Voice-powered medical documentation</p>
            </div>
          </div>
          <div className="hidden md:flex justify-between items-center gap-8">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2 mb-1">
                <Building className="h-4 w-4" />
                <p className="text-sm font-medium text-doctor-primary-foreground/90">
                  {hospitalName}
                </p>
              </div>
              <p className="text-sm text-doctor-primary-foreground/90">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity">
                  <div className="flex flex-col items-end">
                    <p className="font-medium">{userName}</p>
                    <p className="text-xs opacity-80">{userEmail}</p>
                  </div>
                  <Avatar className="h-12 w-12 border-2 border-white/50">
                    <AvatarImage src={photoURL} alt={userName} />
                    <AvatarFallback className="bg-doctor-secondary text-white">{userInitials}</AvatarFallback>
                  </Avatar>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/profile')}>
                  <User className="h-4 w-4 mr-2" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
      {patientInfo.name && (
        <div className="bg-gradient-to-r from-doctor-secondary/20 to-doctor-secondary/5 p-3 rounded-md shadow-sm">
          <p className="text-sm text-doctor-secondary font-medium">
            Current patient: <span className="font-bold">{patientInfo.name}</span> | Session started: {patientInfo.time} | {new Date().toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
};

export default DocHeader;
