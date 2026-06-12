# Complete Edge Functions Reference

Deploy all functions to Supabase Edge Functions. Each uses direct REST API calls.

## Core Functions

### 1. get-draft-articles
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  
  try {
    const { status } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    let url = `${supabaseUrl}/rest/v1/draft_articles?order=created_at.desc`
    if (status && status !== 'all') url += `&status=eq.${status}`
    
    const response = await fetch(url, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    })
    const articles = await response.json()
    
    return new Response(JSON.stringify({ articles: articles || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ articles: [], error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

### 2. update-article-status
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  
  try {
    const { articleId, status, approvedBy, articleData } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const updateData: any = { status }
    if (approvedBy) updateData.approved_by = approvedBy
    if (status === 'published') updateData.published_at = new Date().toISOString()
    if (articleData) Object.assign(updateData, articleData)
    
    await fetch(`${supabaseUrl}/rest/v1/draft_articles?id=eq.${articleId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(updateData)
    })
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

### 3. research-and-generate-articles
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    
    // Get topics from research_topics
    const topicsRes = await fetch(
      `${supabaseUrl}/rest/v1/research_topics?status=eq.pending&limit=3`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    )
    const topics = await topicsRes.json()
    
    if (!topics?.length) {
      return new Response(JSON.stringify({ articlesGenerated: 0, message: 'No topics' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    let generated = 0
    for (const topic of topics) {
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: `Write an SEO article about: ${topic.title}\n\nReturn JSON: {"title":"","slug":"","excerpt":"","content":"<html>","category":"","tags":[],"seo_title":"","seo_description":"","seo_keywords":[]}`
          }]
        })
      })
      
      const aiData = await aiRes.json()
      const article = JSON.parse(aiData.content[0].text)
      
      await fetch(`${supabaseUrl}/rest/v1/draft_articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ ...article, status: 'pending', research_sources: [topic.source_url] })
      })
      
      await fetch(`${supabaseUrl}/rest/v1/research_topics?id=eq.${topic.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ status: 'processed' })
      })
      
      generated++
    }
    
    return new Response(JSON.stringify({ articlesGenerated: generated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

See ADMIN_EDGE_FUNCTIONS.md and ADMIN_EDGE_FUNCTIONS_PART2.md for remaining functions.
