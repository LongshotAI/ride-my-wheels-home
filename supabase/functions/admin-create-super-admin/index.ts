import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // This function should only be called once during initial setup
    // In production, this would be heavily restricted or disabled
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const email = 'lshot.crypto@gmail.com';
    const password = 'Testing123';

    // Create the super admin user in auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: 'Super Administrator'
      }
    });

    if (authError) {
      // User might already exist, try to get user
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users.find(u => u.email === email);
      
      if (existingUser) {
        // User exists, make sure they have super_admin role
        const { data: userRecord } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('id', existingUser.id)
          .single();

        if (!userRecord) {
          // Create user record
          await supabaseAdmin.from('users').insert({
            id: existingUser.id,
            email,
            full_name: 'Super Administrator',
            role: 'super_admin'
          });
        }

        // Ensure super_admin role in user_roles
        await supabaseAdmin.from('user_roles').upsert({
          user_id: existingUser.id,
          role: 'super_admin'
        }, {
          onConflict: 'user_id,role'
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Super admin already exists and has been updated',
            user_id: existingUser.id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        throw authError;
      }
    }

    // Create user record
    await supabaseAdmin.from('users').insert({
      id: authUser.user.id,
      email,
      full_name: 'Super Administrator',
      role: 'super_admin'
    });

    // Add super_admin role
    await supabaseAdmin.from('user_roles').insert({
      user_id: authUser.user.id,
      role: 'super_admin'
    });

    console.log(`✅ Super admin created: ${authUser.user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Super admin user created successfully',
        user_id: authUser.user.id,
        email
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating super admin:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
