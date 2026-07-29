import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Penny AI System Prompt - This defines Penny's personality and knowledge
const PENNY_SYSTEM_PROMPT = `You are Penny, the AI Success Manager at Access Your Place (AYP), powered by Set Up Your Place LLC. You are a warm, knowledgeable, and professional AI assistant specializing in rental arbitrage, short-term rentals (STR), and co-living investments.

## Your Personality:
- Friendly, approachable, and encouraging
- Professional but not stuffy - you use conversational language
- Enthusiastic about helping investors succeed
- Patient with beginners, detailed with experienced investors
- Always honest about risks and realistic expectations

## Your Expertise:
1. **Rental Arbitrage**: Master lease agreements, landlord negotiations, legal considerations, market analysis
2. **Short-Term Rentals (STR)**: Airbnb/VRBO optimization, pricing strategies, guest management, regulations
3. **Co-Living Spaces**: Room-by-room rentals, tenant screening, house rules, community building
4. **Market Analysis**: ADR (Average Daily Rate), occupancy rates, seasonality, competition analysis
5. **Property Evaluation**: ROI calculations, cash flow projections, deal analysis
6. **Operations**: Setup costs, furnishing, cleaning, maintenance, automation tools
7. **Regulations**: Local STR laws, licensing requirements, tax implications

## Access Your Place Services:
- Deal Flow: Vetted rental arbitrage opportunities
- Setup Services: Full property setup including furnishing, photography, listing optimization
- Acquisition Support: Help negotiating with landlords and securing properties
- Portfolio Management: Tools to track and optimize investments
- Education: Resources and guidance for new and experienced investors

## Response Guidelines:
1. Always introduce yourself briefly if it's the start of a conversation
2. Provide specific, actionable advice when possible
3. Use real numbers and examples (e.g., "A typical 3BR in Austin might generate $4,000-6,000/month")
4. Acknowledge when you don't have specific data and suggest how to find it
5. Encourage users to book a call with the AYP team for personalized advice
6. Keep responses focused and scannable - use bullet points for lists
7. If asked about specific deals, remind them to check the Deals page or contact the team
8. Never make guarantees about returns - always mention that results vary

## Important Notes:
- You work for Access Your Place, not as an independent advisor
- Always recommend consulting with the AYP acquisition team for major decisions
- Be transparent about the risks of rental arbitrage
- Encourage users to do their own due diligence
- If asked about topics outside real estate investing, politely redirect to your expertise

Remember: You're here to help investors succeed with rental arbitrage. Be helpful, be honest, and be encouraging!`

// Staff-specific additions to the system prompt
const STAFF_ADDITIONS = `

## Additional Staff Capabilities:
As a staff member, you can also help with:
- Property searches and market research
- Generating listing descriptions and marketing content
- Analyzing deals in the pipeline
- Pulling property photos and information
- Creating reports and summaries
- Answering operational questions

When staff ask you to search or generate content, provide detailed, professional responses suitable for client-facing materials.`

type PennyMsg = { role: string; content: string }

async function callAnthropic(key: string, system: string, messages: PennyMsg[]): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', max_tokens: 1500, system, messages }),
  })
  const data = await res.json()
  if (!res.ok || data?.error) throw new Error(data?.error?.message || `anthropic http ${res.status}`)
  const text = data?.content?.[0]?.text
  if (!text) throw new Error('anthropic returned no text')
  return text
}

async function callOpenAI(key: string, system: string, messages: PennyMsg[]): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'gpt-4o', max_tokens: 1500, messages: [{ role: 'system', content: system }, ...messages] }),
  })
  const data = await res.json()
  if (!res.ok || data?.error) throw new Error(data?.error?.message || `openai http ${res.status}`)
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error('openai returned no text')
  return text
}

// Claude (Anthropic) first; OpenAI as an automatic fallback if Claude's key is missing or the call fails.
async function askPennyDual(system: string, messages: PennyMsg[]): Promise<string> {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  const errors: string[] = []
  if (anthropicKey) {
    try { return await callAnthropic(anthropicKey, system, messages) }
    catch (e) { errors.push(`anthropic: ${e instanceof Error ? e.message : 'failed'}`) }
  }
  if (openaiKey) {
    try { return await callOpenAI(openaiKey, system, messages) }
    catch (e) { errors.push(`openai: ${e instanceof Error ? e.message : 'failed'}`) }
  }
  throw new Error(errors.length ? errors.join(' | ') : 'no reasoning provider configured')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action, user_id, user_type, user_name, message, session_id, conversation_history } = body
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

    // Action: Get suggested questions
    if (action === 'get_suggested_questions') {
      const userTypeFilter = user_type || 'investor'
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/ai_suggested_questions?user_type=eq.${userTypeFilter}&is_active=eq.true&order=priority.desc&limit=8`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      )
      
      const questions = await response.json()
      
      // If no questions in database, return defaults
      if (!questions || questions.length === 0) {
        const defaults = userTypeFilter === 'staff' ? [
          "Search for properties in Austin, TX",
          "Generate a listing description for a 3BR property",
          "What are the STR regulations in Nashville?",
          "Analyze the co-living market in Denver"
        ] : [
          "What markets are best for STR investing right now?",
          "How does rental arbitrage work?",
          "How much capital do I need to get started?",
          "What ROI should I expect from rental arbitrage?",
          "Can you explain co-living vs short-term rentals?",
          "What are the risks of rental arbitrage?"
        ]
        
        return new Response(JSON.stringify({ suggestions: defaults }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify({ 
        suggestions: questions.map((q: any) => q.question) 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Action: Get chat history
    if (action === 'get_history') {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/ai_chat_sessions?user_id=eq.${user_id}&user_type=eq.${user_type || 'investor'}&order=updated_at.desc&limit=10`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      )
      
      const history = await response.json()
      
      return new Response(JSON.stringify({ history: history || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Action: Chat with Penny
    if (action === 'chat') {
      if (!anthropicKey) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'AI service not configured. Please contact support.',
          message: "I'm sorry, but I'm having trouble connecting to my brain right now! Please try again in a moment, or reach out to our team directly at support@accessyourplace.com."
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (!message) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Message is required'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Build the system prompt based on user type
      let systemPrompt = PENNY_SYSTEM_PROMPT
      if (user_type === 'staff') {
        systemPrompt += STAFF_ADDITIONS
      }

      // Add user context to the system prompt
      if (user_name) {
        systemPrompt += `\n\nYou are currently chatting with ${user_name}. Address them by their first name when appropriate.`
      }

      // Build conversation messages for the AI
      const messages: any[] = []
      
      // Add conversation history if provided
      if (conversation_history && Array.isArray(conversation_history)) {
        for (const msg of conversation_history.slice(-10)) { // Keep last 10 messages for context
          messages.push({
            role: msg.role,
            content: msg.content
          })
        }
      } else {
        // Just add the current message
        messages.push({
          role: 'user',
          content: message
        })
      }

      // Reason with Claude first; fall back to OpenAI if Claude's key is missing or fails.
      let dualText = ''
      let dualError: unknown = null
      try {
        dualText = await askPennyDual(systemPrompt, messages)
      } catch (err) {
        dualError = err
        console.error('AI providers failed:', err)
      }
      const aiData: any = dualError ? { error: dualError } : { content: [{ text: dualText }] }
      
      if (aiData.error) {
        console.error('Anthropic API error:', aiData.error)
        return new Response(JSON.stringify({ 
          success: false,
          error: 'AI service error',
          message: "I apologize, but I'm experiencing some technical difficulties. Please try again in a moment, or feel free to reach out to our team directly!"
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const assistantMessage = aiData.content?.[0]?.text || "I'm sorry, I couldn't generate a response. Please try again."

      // Save the conversation to the database
      if (user_id) {
        const newSessionId = session_id || `session_${Date.now()}`
        const updatedMessages = [
          ...(conversation_history || []),
          { role: 'user', content: message, timestamp: new Date().toISOString() },
          { role: 'assistant', content: assistantMessage, timestamp: new Date().toISOString() }
        ]

        // Check if session exists
        const existingSession = await fetch(
          `${supabaseUrl}/rest/v1/ai_chat_sessions?session_id=eq.${newSessionId}&user_id=eq.${user_id}`,
          { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
        )
        const sessions = await existingSession.json()

        if (sessions && sessions.length > 0) {
          // Update existing session
          await fetch(
            `${supabaseUrl}/rest/v1/ai_chat_sessions?id=eq.${sessions[0].id}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                messages: updatedMessages,
                updated_at: new Date().toISOString()
              })
            }
          )
        } else {
          // Create new session
          await fetch(
            `${supabaseUrl}/rest/v1/ai_chat_sessions`,
            {
              method: 'POST',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                user_id: user_id,
                user_type: user_type || 'investor',
                session_id: newSessionId,
                messages: updatedMessages
              })
            }
          )
        }
      }

      return new Response(JSON.stringify({ 
        success: true,
        message: assistantMessage,
        session_id: session_id || `session_${Date.now()}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Unknown action
    return new Response(JSON.stringify({ 
      error: 'Unknown action',
      valid_actions: ['get_suggested_questions', 'get_history', 'chat']
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Edge function error:', error)
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      message: "Oops! Something went wrong on my end. Please try again, or contact our team if the issue persists."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
