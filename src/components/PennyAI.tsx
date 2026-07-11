import React, { useState } from 'react';

const PENNY_AGENT_ID = '4b1a2e49-ba72-4b7a-b034-0946c680376a';
const PENNY_URL = `https://godaddy-agent.aiassistant.co/web-agent?agent_id=${PENNY_AGENT_ID}`;

interface PennyAIProps {
  /** 'floating' renders a fixed chat bubble in the corner; 'inline' renders inline */
  mode?: 'floating' | 'inline';
  /** For inline mode — height of the chat window */
  height?: string;
}

const PennyAI: React.FC<PennyAIProps> = ({ mode = 'floating', height = '600px' }) => {
  const [open, setOpen] = useState(false);

  if (mode === 'inline') {
    return (
      <div style={{ width: '100%', maxWidth: '500px', margin: '0 auto' }}>
        <iframe
          src={PENNY_URL}
          style={{
            width: '100%',
            height,
            borderRadius: '18px',
            border: 'none',
            display: 'block',
          }}
          allow="microphone"
          title="Penny – Access Your Place AI Assistant"
        />
      </div>
    );
  }

  // Floating bubble mode
  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close Penny AI chat' : 'Open Penny AI chat'}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #6394ff, #a855f7)',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(99,148,255,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: '24px',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {open ? '✕' : '💬'}
      </button>

      {/* Chat window */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: '96px',
            right: '24px',
            zIndex: 9998,
            width: '380px',
            height: '560px',
            borderRadius: '18px',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
            animation: 'penny-slide-up 0.22s ease',
          }}
        >
          <iframe
            src={PENNY_URL}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="microphone"
            title="Penny – Access Your Place AI Assistant"
          />
        </div>
      )}

      <style>{`
        @keyframes penny-slide-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

export default PennyAI;
