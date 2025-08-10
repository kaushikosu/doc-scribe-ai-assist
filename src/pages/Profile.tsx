import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";
import { Loader2 } from "lucide-react";

const Profile: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialFormData, setInitialFormData] = useState<Record<string, string>>({});
  const [currentFormData, setCurrentFormData] = useState<Record<string, string>>({});
  
  // Load existing profile data
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userRes.user) return;

        const { data: profile, error: profileErr } = await supabase
          .from('doctor_profiles')
          .select('*')
          .eq('user_id', userRes.user.id)
          .maybeSingle();

        if (profileErr) throw profileErr;

        if (profile) {
          const formData = {
            full_name: profile.full_name || '',
            gender: profile.gender || '',
            dob: profile.dob || '',
            phone: profile.phone || '',
            email: profile.email || '',
            qualifications: profile.qualifications || '',
            registration_council: profile.registration_council || '',
            registration_number: profile.registration_number || '',
            registration_year: profile.registration_year?.toString() || '',
            speciality: profile.speciality || '',
            facility_name: profile.facility_name || '',
            facility_id: profile.facility_id || '',
            address_line1: profile.address_line1 || '',
            address_line2: profile.address_line2 || '',
            district: profile.district || '',
            state: profile.state || '',
            pincode: profile.pincode || '',
          };
          setInitialFormData(formData);
          setCurrentFormData(formData);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
    };

    loadProfile();
  }, []);

  // Track form changes
  const handleInputChange = (field: string, value: string) => {
    const newFormData = { ...currentFormData, [field]: value };
    setCurrentFormData(newFormData);
    
    // Check if form has changes
    const hasChanged = Object.keys(newFormData).some(
      key => newFormData[key] !== initialFormData[key]
    );
    setHasChanges(hasChanged);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) {
        toast.error("You must be signed in to save your profile.");
        return;
      }

      const payload: any = {
        full_name: currentFormData.full_name || null,
        gender: currentFormData.gender || null,
        dob: currentFormData.dob || null,
        phone: currentFormData.phone || null,
        email: currentFormData.email || null,
        qualifications: currentFormData.qualifications || null,
        registration_council: currentFormData.registration_council || null,
        registration_number: currentFormData.registration_number || null,
        registration_year: currentFormData.registration_year ? Number(currentFormData.registration_year) : null,
        speciality: currentFormData.speciality || null,
        facility_name: currentFormData.facility_name || null,
        facility_id: currentFormData.facility_id || null,
        address_line1: currentFormData.address_line1 || null,
        address_line2: currentFormData.address_line2 || null,
        district: currentFormData.district || null,
        state: currentFormData.state || null,
        pincode: currentFormData.pincode || null,
      };

      // Set timeout to prevent frozen UX
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );

      // Check if profile exists
      const { data: existing, error: selectErr } = await Promise.race([
        supabase
          .from('doctor_profiles')
          .select('id')
          .eq('user_id', userRes.user.id)
          .maybeSingle(),
        timeoutPromise
      ]) as { data: any; error: any };

      if (selectErr) throw selectErr;

      if (existing?.id) {
        const { error: updErr } = await Promise.race([
          supabase
            .from('doctor_profiles')
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq('id', existing.id),
          timeoutPromise
        ]) as { error: any };
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await Promise.race([
          supabase
            .from('doctor_profiles')
            .insert({ ...payload, user_id: userRes.user.id }),
          timeoutPromise
        ]) as { error: any };
        if (insErr) throw insErr;
      }

      // Update initial form data to reflect saved state
      setInitialFormData(currentFormData);
      setHasChanges(false);
      
      toast.success('Profile updated successfully');
    } catch (err) {
      console.error(err);
      if (err instanceof Error && err.message === 'Request timeout') {
        toast.error('Request timed out. Please try again.');
      } else {
        toast.error('Failed to save profile');
      }
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <main className="container mx-auto max-w-3xl py-6">
      <h1 className="text-2xl font-bold mb-4">Doctor Profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>Edit your ABDM-aligned profile</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full_name">Full name</Label>
                <Input 
                  id="full_name" 
                  name="full_name" 
                  placeholder="Dr. Jane Doe" 
                  value={currentFormData.full_name || ''}
                  onChange={(e) => handleInputChange('full_name', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="gender">Gender</Label>
                <Input 
                  id="gender" 
                  name="gender"
                  placeholder="female/male/other" 
                  value={currentFormData.gender || ''}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dob">Date of birth</Label>
                <Input 
                  id="dob" 
                  name="dob"
                  type="date" 
                  value={currentFormData.dob || ''}
                  onChange={(e) => handleInputChange('dob', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input 
                  id="phone" 
                  name="phone"
                  placeholder="+91-XXXXXXXXXX" 
                  value={currentFormData.phone || ''}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  name="email"
                  type="email" 
                  placeholder="doctor@example.com" 
                  value={currentFormData.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="qualifications">Qualifications</Label>
                <Input 
                  id="qualifications" 
                  name="qualifications"
                  placeholder="MBBS, MD (Medicine)" 
                  value={currentFormData.qualifications || ''}
                  onChange={(e) => handleInputChange('qualifications', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="registration_council">Registration Council</Label>
                <Input 
                  id="registration_council" 
                  name="registration_council"
                  placeholder="MCI/State Council" 
                  value={currentFormData.registration_council || ''}
                  onChange={(e) => handleInputChange('registration_council', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="registration_number">Registration Number</Label>
                <Input 
                  id="registration_number" 
                  name="registration_number"
                  placeholder="ABC12345" 
                  value={currentFormData.registration_number || ''}
                  onChange={(e) => handleInputChange('registration_number', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="registration_year">Registration Year</Label>
                <Input 
                  id="registration_year" 
                  name="registration_year"
                  type="number" 
                  placeholder="2015" 
                  value={currentFormData.registration_year || ''}
                  onChange={(e) => handleInputChange('registration_year', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="speciality">Speciality</Label>
                <Input 
                  id="speciality" 
                  name="speciality"
                  placeholder="Cardiology" 
                  value={currentFormData.speciality || ''}
                  onChange={(e) => handleInputChange('speciality', e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="facility_name">Facility Name</Label>
                <Input 
                  id="facility_name" 
                  name="facility_name"
                  placeholder="Arogya General Hospital" 
                  value={currentFormData.facility_name || ''}
                  onChange={(e) => handleInputChange('facility_name', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="facility_id">Facility ID</Label>
                <Input 
                  id="facility_id" 
                  name="facility_id"
                  placeholder="FAC-001" 
                  value={currentFormData.facility_id || ''}
                  onChange={(e) => handleInputChange('facility_id', e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="address_line1">Address Line 1</Label>
                <Input 
                  id="address_line1" 
                  name="address_line1"
                  placeholder="Street, Area" 
                  value={currentFormData.address_line1 || ''}
                  onChange={(e) => handleInputChange('address_line1', e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="address_line2">Address Line 2</Label>
                <Input 
                  id="address_line2" 
                  name="address_line2"
                  placeholder="Landmark" 
                  value={currentFormData.address_line2 || ''}
                  onChange={(e) => handleInputChange('address_line2', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="district">District</Label>
                <Input 
                  id="district" 
                  name="district"
                  placeholder="District" 
                  value={currentFormData.district || ''}
                  onChange={(e) => handleInputChange('district', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input 
                  id="state" 
                  name="state"
                  placeholder="State" 
                  value={currentFormData.state || ''}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pincode">Pincode</Label>
                <Input 
                  id="pincode" 
                  name="pincode"
                  placeholder="560001" 
                  value={currentFormData.pincode || ''}
                  onChange={(e) => handleInputChange('pincode', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button 
              type="submit" 
              disabled={isLoading || !hasChanges}
              className="min-w-[120px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                'Save profile'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
};

export default Profile;
