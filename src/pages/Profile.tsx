import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const Profile: React.FC = () => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Wire to Supabase doctor_profiles table
    // For now, this is a placeholder action
    alert("Profile saved. (DB wiring pending)");
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
                <Input id="full_name" placeholder="Dr. Jane Doe" />
              </div>
              <div>
                <Label htmlFor="gender">Gender</Label>
                <Input id="gender" placeholder="female/male/other" />
              </div>
              <div>
                <Label htmlFor="dob">Date of birth</Label>
                <Input id="dob" type="date" />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" placeholder="+91-XXXXXXXXXX" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="doctor@example.com" />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="qualifications">Qualifications</Label>
                <Input id="qualifications" placeholder="MBBS, MD (Medicine)" />
              </div>
              <div>
                <Label htmlFor="registration_council">Registration Council</Label>
                <Input id="registration_council" placeholder="MCI/State Council" />
              </div>
              <div>
                <Label htmlFor="registration_number">Registration Number</Label>
                <Input id="registration_number" placeholder="ABC12345" />
              </div>
              <div>
                <Label htmlFor="registration_year">Registration Year</Label>
                <Input id="registration_year" type="number" placeholder="2015" />
              </div>
              <div>
                <Label htmlFor="speciality">Speciality</Label>
                <Input id="speciality" placeholder="Cardiology" />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="facility_name">Facility Name</Label>
                <Input id="facility_name" placeholder="Arogya General Hospital" />
              </div>
              <div>
                <Label htmlFor="facility_id">Facility ID</Label>
                <Input id="facility_id" placeholder="FAC-001" />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="address_line1">Address Line 1</Label>
                <Input id="address_line1" placeholder="Street, Area" />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="address_line2">Address Line 2</Label>
                <Input id="address_line2" placeholder="Landmark" />
              </div>
              <div>
                <Label htmlFor="district">District</Label>
                <Input id="district" placeholder="District" />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input id="state" placeholder="State" />
              </div>
              <div>
                <Label htmlFor="pincode">Pincode</Label>
                <Input id="pincode" placeholder="560001" />
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit">Save profile</Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
};

export default Profile;
