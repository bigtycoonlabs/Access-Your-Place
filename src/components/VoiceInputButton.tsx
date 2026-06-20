import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  onAutoSend?: (text: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'default' | 'lg' | 'icon';
  className?: string;
  autoSendDelay?: number; // ms after silence to auto-send (default 2000)
}

// Check if SpeechRecognition is available
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export function VoiceInputButton({
  onTranscript,
  onAutoSend,
  disabled = false,
  size = 'sm',
  className = '',
  autoSendDelay = 2000
}: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const autoSendTimerRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    setIsSupported(!!SpeechRecognition);
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
    setInterimText('');
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognition || disabled) return;

    // Clean up any existing instance
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    finalTranscriptRef.current = '';

    recognition.onstart = () => {
      setIsListening(true);
      setInterimText('');
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      if (final) {
        finalTranscriptRef.current += final;
        onTranscript(finalTranscriptRef.current);
        setInterimText('');

        // Reset auto-send timer on new final result
        if (autoSendTimerRef.current) {
          clearTimeout(autoSendTimerRef.current);
        }
        autoSendTimerRef.current = setTimeout(() => {
          if (finalTranscriptRef.current.trim() && onAutoSend) {
            onAutoSend(finalTranscriptRef.current.trim());
            finalTranscriptRef.current = '';
            stopListening();
          }
        }, autoSendDelay);
      } else {
        setInterimText(interim);
        // Update the input with interim + final
        onTranscript(finalTranscriptRef.current + interim);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        stopListening();
      }
    };

    recognition.onend = () => {
      // If we still have a final transcript and auto-send is enabled
      if (finalTranscriptRef.current.trim() && onAutoSend) {
        onAutoSend(finalTranscriptRef.current.trim());
        finalTranscriptRef.current = '';
      }
      setIsListening(false);
      setInterimText('');
    };

    recognitionRef.current = recognition;
    
    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  }, [disabled, onTranscript, onAutoSend, autoSendDelay, stopListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      if (autoSendTimerRef.current) {
        clearTimeout(autoSendTimerRef.current);
      }
    };
  }, []);

  if (!isSupported) return null;

  return (
    <div className="relative inline-flex items-center">
      <Button
        type="button"
        size={size}
        variant={isListening ? 'default' : 'outline'}
        onClick={toggleListening}
        disabled={disabled}
        className={`relative ${isListening ? 'bg-red-500 hover:bg-red-600 text-white border-red-500' : 'hover:bg-purple-50 border-gray-300'} ${className}`}
        aria-label={isListening ? 'Stop voice input. Penny is listening.' : 'Start voice input. Speak your message to Penny.'}
        aria-pressed={isListening}
      >
        {isListening ? (
          <>
            <MicOff className="w-4 h-4" />
            {/* Pulsing ring animation */}
            <span className="absolute inset-0 rounded-md border-2 border-red-400 animate-ping opacity-30" />
          </>
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </Button>
      
      {/* Listening indicator */}
      {isListening && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse pointer-events-none">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          Listening...
        </div>
      )}
    </div>
  );
}

export default VoiceInputButton;
