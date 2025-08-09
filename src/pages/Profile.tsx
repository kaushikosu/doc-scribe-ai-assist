import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";

const DoctorProfileSchema = z.object({
  full_name: z.string().min(2, "Name is required"),
  gender: z.string().optional(),
  dob: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  qualifications: z.string().optional(),
  registration_council: z.string().optional(),
  registration_number: z.string().optional(),
  registration_year: z.string().optional(),
  speciality: z.string().optional(),
  facility_name: z.string().optional(),
  facility_id: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional()
});

type DoctorProfileForm = z.infer<typeof DoctorProfileSchema>;

const Profile: React.FC = () => {
  useEffect(() => {
    // Basic SEO for the page
    document.title = "Doctor Profile | DocScribe";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = "Manage your ABDM-compliant doctor profile in DocScribe.";
      document.head.appendChild(m);
    } else {
      metaDescription.setAttribute("content", "Manage your ABDM-compliant doctor profile in DocScribe.");
    }
  }, []);

  const form = useForm<DoctorProfileForm>({
    resolver: zodResolver(DoctorProfileSchema),
    defaultValues: {
      full_name: "",
      gender: "",
      dob: "",
      phone: "",
      email: "",
      qualifications: "",
      registration_council: "",
      registration_number: "",
      registration_year: "",
      speciality: "",
      facility_name: "",
      facility_id: "",
      address_line1: "",
      address_line2: "",
      district: "",
      state: "",
      pincode: ""
    }
  });

  useEffect(() => {
    const loadProfile = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        toast("Not signed in", { description: "Sign in with Supabase to manage your profile." });
        return;
      }
      const { data, error } = await (supabase as any)
        .from("doctor_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        console.error(error);
        toast("Error", { description: "Failed to load profile" });
      } else if (data) {
        form.reset({
          full_name: data.full_name || "",
          gender: data.gender || "",
          dob: data.dob || "",
          phone: data.phone || "",
          email: data.email || "",
          qualifications: data.qualifications || "",
          registration_council: data.registration_council || "",
          registration_number: data.registration_number || "",
          registration_year: (data.registration_year?.toString?.() as string) || "",
          speciality: data.speciality || "",
          facility_name: data.facility_name || "",
          facility_id: data.facility_id || "",
          address_line1: data.address_line1 || "",
          address_line2: data.address_line2 || "",
          district: data.district || "",
          state: data.state || "",
          pincode: data.pincode || ""
        });
      }
    };
    loadProfile();
  }, [form]);

  const onSubmit = async (values: DoctorProfileForm) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) {
      toast("Not signed in", { description: "Supabase auth required to save profile." });
      return;
    }
    const payload: any = {
      user_id: userId,
      ...values,
      registration_year: values.registration_year ? parseInt(values.registration_year, 10) : null
    };
    const { error } = await (supabase as any).from("doctor_profiles").upsert(payload, { onConflict: "user_id" });
    if (error) {
      console.error(error);
      toast("Save failed", { description: error.message });
    } else {
      toast("Profile saved", { description: "Your doctor profile has been updated." });
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-doctor-light via-white to-doctor-light/20">
      <div className="container py-8 max-w-4xl">
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <h1 className="text-2xl font-bold mb-2">Doctor Profile (ABDM)</h1>
            <p className="text-sm text-muted-foreground mb-6">Maintain required details as per ABDM format.</p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField name="full_name" control={form.control} render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Dr. Jane Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField name="gender" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <FormControl>
                      <Input placeholder="Male/Female/Other" {...field} />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField name="dob" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField name="phone" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+91-XXXXXXXXXX" {...field} />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField name="email" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="doctor@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField name="qualifications" control={form.control} render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Qualifications</FormLabel>
                    <FormControl>
                      <Input placeholder="MBBS, MD (Internal Medicine)" {...field} />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField name="registration_council" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registration Council</FormLabel>
                    <FormControl>
                      <Input placeholder="State Medical Council" {...field} />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField name="registration_number" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registration Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 123456" {...field} />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField name="registration_year" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registration Year</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 2012" {...field} />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField name="speciality" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Speciality</FormLabel>
                    <FormControl>
                      <Input placeholder="Cardiology" {...field} />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField name="facility_name" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Facility Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Hospital/Clinic Name" {...field} />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField name="facility_id" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Facility ID (HFR)</FormLabel>
                    <FormControl>
                      <Input placeholder="HFR ID if available" {...field} />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField name="address_line1" control={form.control} render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Address Line 1</FormLabel>
                    <FormControl>
                      <Input placeholder="Street, Area" {...field} />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField name="address_line2" control={form.control} render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Address Line 2</FormLabel>
                    <FormControl>
                      <Input placeholder="Landmark" {...field} />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField name="district" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>District</FormLabel>
                    <FormControl>
                      <Input placeholder="District" {...field} />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField name="state" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input placeholder="State" {...field} />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField name="pincode" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pincode</FormLabel>
                    <FormControl>
                      <Input placeholder="6-digit Pincode" {...field} />
                    </FormControl>
                  </FormItem>
                )} />

                <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                  <Button type="button" variant="outline" onClick={() => form.reset()}>Reset</Button>
                  <Button type="submit">Save Profile</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default Profile;
