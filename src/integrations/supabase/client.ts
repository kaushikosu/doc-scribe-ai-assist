import { createClient } from '@supabase/supabase-js';

// Supabase project configuration
const supabaseUrl = 'https://vtbpeozzyaqxjgmroeqs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0YnBlb3p6eWFxeGpnbXJvZXFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxOTAwODUsImV4cCI6MjA2MDc2NjA4NX0.F7VCtKu7d0ob3OUhhLZW9NDeyziw1Vah2uNJxQSCr5g';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
