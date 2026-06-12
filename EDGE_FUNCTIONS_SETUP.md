# Edge Functions Setup Guide

## Required Edge Functions

You need to create these edge functions in your Supabase project. Go to **Edge Functions** in your Supabase dashboard and create each function.

---

## 1. daily-article-generation

**Purpose**: Generates 10 articles from research queue (Monday-Friday only)

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check if today is Monday-Friday
    const today = new Date()
    const dayOfWeek = today.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return new Response(JSON.stringify({ 
        message: 'Skipped - Weekend', 
        articlesGenerated: 0 
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    // Get 10 topics from research queue
    const { data: topics } = await supabaseClient
      .from('research_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority_score', { ascending: false })
      .limit(10)

    if (!topics || topics.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No topics in queue', 
        articlesGenerated: 0 
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    let articlesGenerated = 0

    for (const topic of topics) {
      // Call research-and-generate-articles for each topic
      const { data } = await supabaseClient.functions.invoke('research-and-generate-articles', {
        body: { topicId: topic.id, topic: topic.topic }
      })
      
      if (data?.success) articlesGenerated++
    }

    return new Response(JSON.stringify({ 
      success: true, 
      articlesGenerated 
    }), { headers: { 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

---

## 2. discover-trending-topics

**Purpose**: Scrapes multiple sources for trending rental arbitrage topics

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const topics = []

    // Scrape Reddit
    const redditTopics = await scrapeReddit()
    topics.push(...redditTopics)

    // Scrape BiggerPockets
    const bpTopics = await scrapeBiggerPockets()
    topics.push(...bpTopics)

    // Scrape Twitter/X
    const twitterTopics = await scrapeTwitter()
    topics.push(...twitterTopics)

    // Scrape YouTube
    const youtubeTopics = await scrapeYouTube()
    topics.push(...youtubeTopics)

    // Scrape Real Estate News
    const newsTopics = await scrapeRealEstateNews()
    topics.push(...newsTopics)

    // Insert into discovered_topics
    for (const topic of topics) {
      await supabaseClient.from('discovered_topics').insert(topic)
      
      // Check similarity and add to queue if high priority
      if (topic.priority_score >= 70) {
        const { data } = await supabaseClient.functions.invoke('check-topic-similarity', {
          body: { topic }
        })
        
        if (data?.isUnique) {
          await supabaseClient.from('research_queue').insert({
            topic: topic.title,
            description: topic.content,
            source: topic.source,
            source_url: topic.source_url,
            priority_score: topic.priority_score
          })
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      topicsDiscovered: topics.length 
    }), { headers: { 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

async function scrapeReddit() {
  // Implementation for Reddit scraping
  return []
}

async function scrapeBiggerPockets() {
  // Implementation for BiggerPockets scraping
  return []
}

async function scrapeTwitter() {
  // Implementation for Twitter scraping
  return []
}

async function scrapeYouTube() {
  // Implementation for YouTube scraping
  return []
}

async function scrapeRealEstateNews() {
  // Implementation for news scraping
  return []
}
```

---

## 3. check-topic-similarity

**Purpose**: Uses AI to detect duplicate topics

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { topic } = await req.json()
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get existing topics from queue and published articles
    const { data: queueTopics } = await supabaseClient
      .from('research_queue')
      .select('topic, description')
    
    const { data: articles } = await supabaseClient
      .from('blog_articles')
      .select('title, meta_description')
      .limit(100)

    // Use AI to check similarity
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Compare this topic: "${topic.title}" with existing topics and return a similarity score (0-100). 
          
Existing queue: ${JSON.stringify(queueTopics?.slice(0, 20))}
Recent articles: ${JSON.stringify(articles?.slice(0, 20))}

Return JSON: { "similarityScore": number, "isDuplicate": boolean, "reason": string }`
        }]
      })
    })

    const aiResult = await response.json()
    const result = JSON.parse(aiResult.content[0].text)

    return new Response(JSON.stringify({ 
      isUnique: !result.isDuplicate,
      similarityScore: result.similarityScore,
      reason: result.reason
    }), { headers: { 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

---

## 4. monitor-regulation-feeds

**Purpose**: Monitors RSS feeds and news for regulation updates

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const alerts = []

    // Monitor city government sites
    const cityAlerts = await monitorCityFeeds()
    alerts.push(...cityAlerts)

    // Monitor real estate news
    const newsAlerts = await monitorNewsFeeds()
    alerts.push(...newsAlerts)

    // Insert alerts
    for (const alert of alerts) {
      await supabaseClient.from('regulation_alerts').insert(alert)
      
      // Add critical/high severity to queue
      if (alert.severity === 'critical' || alert.severity === 'high') {
        await supabaseClient.from('research_queue').insert({
          topic: alert.title,
          description: alert.description,
          source: alert.source,
          source_url: alert.source_url,
          priority_score: alert.severity === 'critical' ? 95 : 85
        })
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      alertsFound: alerts.length 
    }), { headers: { 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

async function monitorCityFeeds() {
  return []
}

async function monitorNewsFeeds() {
  return []
}
```

---

## Setup Instructions

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions**
3. Click **New Function** for each function above
4. Copy the code and paste it
5. Set environment variables:
   - `ANTHROPIC_API_KEY` - Your Claude API key
6. Deploy each function
7. Test using the Staff Dashboard

## Testing

Use the buttons in the Staff Dashboard > Topic Discovery tab to test:
- "Discover Topics" - Tests discover-trending-topics
- "Generate 10 Articles" - Tests daily-article-generation
