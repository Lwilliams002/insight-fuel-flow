import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create service client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    // Get request body
    const { email, password, fullName, role } = await req.json()

    if (!email || !password || !fullName || !role) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (role !== 'admin' && role !== 'rep') {
      return new Response(JSON.stringify({ error: 'Invalid role' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create the user using admin API
    const { data: authData, error: createUserError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (createUserError) {
      return new Response(JSON.stringify({ error: createUserError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = authData.user.id

    // Create profile
    const { error: profileError } = await serviceClient.from('profiles').insert({
      id: userId,
      email,
      full_name: fullName,
    })

    if (profileError) {
      console.error('Profile creation error:', profileError)
    }

    // If rep, create rep record
    if (role === 'rep') {
      const { error: repError } = await serviceClient.from('reps').insert({
        user_id: userId,
        commission_level: 'silver',
      })

      if (repError) {
        await serviceClient.auth.admin.deleteUser(userId)
        return new Response(JSON.stringify({ error: 'Failed to create rep record: ' + repError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Assign role
    const { error: roleInsertError } = await serviceClient.from('user_roles').insert({
      user_id: userId,
      role: role,
    })

    if (roleInsertError) {
      if (role === 'rep') {
        await serviceClient.from('reps').delete().eq('user_id', userId)
      }
      await serviceClient.auth.admin.deleteUser(userId)
      return new Response(JSON.stringify({ error: 'Failed to assign role: ' + roleInsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, userId, role }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
