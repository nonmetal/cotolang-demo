"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle } from "lucide-react"

interface ErrorCorrection {
  id: string
  original: string
  corrected: string
  explanation: string
  timestamp: Date
}

interface ErrorCorrectionPanelProps {
  characterName: string
  apiKey?: string
}

export default function ErrorCorrectionPanel({ characterName, apiKey }: ErrorCorrectionPanelProps) {
  const [corrections, setCorrections] = useState<ErrorCorrection[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Function to add a new correction
  const addCorrection = (correction: ErrorCorrection) => {
    setCorrections(prev => [correction, ...prev])
  }

  // Function to process user speech and detect errors
  const processUserSpeech = async (text: string) => {
    if (!text.trim()) return
    
    // Check if we have an API key available
    const apiKeyToUse = apiKey || process.env.NEXT_PUBLIC_OPENAI_API_KEY
    if (!apiKeyToUse) {
      console.error('No OpenAI API key available')
      setIsLoading(false)
      return
    }
    
    setIsLoading(true)
    
    try {
      const systemPrompt = `
You are a meticulous writing assistant.
Task:
1. Read the user's message.
2. If you detect grammar, spelling, punctuation, or usage errors, rewrite the sentence(s) so they are clear, natural, and correct, while preserving the original meaning, tone, and register.
3. If the user text is already correct, reply with "✓ No corrections needed."
4. Never add or omit information; only correct language mistakes.
5. Output the corrected version (or the ✓ message if correct) with the explanation why it is wrong. Make this to be not verbose.

Formatting Rules
- Maintain the user's line breaks and paragraph structure.
- Keep proper nouns, technical terms, emojis, and Markdown exactly as written unless they contain errors.
- Do not surround your answer with quotation marks or code blocks.
`.trim()

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKeyToUse}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ],
          temperature: 0
        })
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      const correctionText = data.choices[0].message.content.trim()
      
      // Only add if there's an actual correction (not "No corrections needed")
      if (!correctionText.startsWith('✓')) {
        // Parse the correction and explanation
        const parts = correctionText.split(/\n+/)
        const corrected = parts[0]
        const explanation = parts.length > 1 ? parts.slice(1).join('\n') : 'Grammar or usage error'
        
        addCorrection({
          id: Date.now().toString(),
          original: text,
          corrected,
          explanation,
          timestamp: new Date()
        })
      }
    } catch (error) {
      console.error('Error processing correction:', error)
      // Add an error message to the corrections list
      addCorrection({
        id: Date.now().toString(),
        original: text,
        corrected: "I'm having trouble generating feedback right now",
        explanation: `Error: ${error instanceof Error ? error.message : 'API connection issue'}. Please try again or check your API key configuration.`,
        timestamp: new Date()
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Listen for custom events from the main chat component
  useEffect(() => {
    const handleUserSpeech = (event: CustomEvent) => {
      processUserSpeech(event.detail.text)
    }

    // Add event listener
    window.addEventListener('user-speech' as any, handleUserSpeech as EventListener)

    // Clean up
    return () => {
      window.removeEventListener('user-speech' as any, handleUserSpeech as EventListener)
    }
  }, [])

  return (
    <Card className="bg-gray-800 border-gray-700 h-full flex flex-col">
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <h3 className="font-medium text-white">Language Corrections</h3>
        </div>
        <Badge variant="outline" className="text-xs border-amber-500 text-amber-400">
          {characterName}
        </Badge>
      </div>
      
      <CardContent className="p-3 flex-grow overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center p-4">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
            </div>
          </div>
        )}
        
        {corrections.length === 0 && !isLoading && (
          <div className="text-center p-6 text-gray-400">
            <p>No language errors detected yet.</p>
            <p className="text-sm mt-2">Corrections will appear here as you speak.</p>
          </div>
        )}
        
        {corrections.map(correction => (
          <div key={correction.id} className="mb-4 bg-gray-750 rounded-lg p-3 border-l-2 border-amber-500">
            <div className="mb-2">
              <div className="text-red-400 line-through text-sm">{correction.original}</div>
              <div className="text-green-400 text-sm mt-1">{correction.corrected}</div>
            </div>
            <div className="text-xs text-gray-400 mt-2 border-t border-gray-700 pt-2">
              {correction.explanation}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {correction.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
