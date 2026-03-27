import { useState } from 'react';
import './App.css';

interface CaptionResult {
  caption: string;
  hashtags: string[];
  reflection: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button className="copy-btn" onClick={handleCopy}>
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export default function App() {
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<CaptionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Generation failed');
      }

      const data: CaptionResult = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const hashtagString = result ? result.hashtags.map(h => `#${h}`).join(' ') : '';

  return (
    <>
      <div className="bg" aria-hidden="true">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      <div className="page">
        <header className="header">
          <div className="header-badge">AI Caption Generator</div>
          <h1>ShippedByMe</h1>
          <p>Describe what you built — get an Instagram caption, hashtags, and a reflection.</p>
        </header>

        <main className="main">
          <div className="card">
            <label htmlFor="description" className="label">
              What did you build?
            </label>
            <textarea
              id="description"
              className="textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. A Chrome extension that highlights toxic comments in red before you post them. Built with vanilla JS and the Perspective API. Took me two weekends — learned a lot about content scripts and async messaging."
              rows={6}
            />
            <button
              className="generate-btn"
              onClick={generate}
              disabled={loading || !description.trim()}
            >
              {loading ? (
                <span className="loading-text">
                  <span className="spinner" /> Generating…
                </span>
              ) : (
                'Generate Caption'
              )}
            </button>
          </div>

          {error && <div className="error">{error}</div>}

          {result && (
            <div className="results">
              <div className="result-card">
                <div className="result-header">
                  <h2>Caption</h2>
                  <CopyButton text={result.caption} />
                </div>
                <p className="result-body">{result.caption}</p>
              </div>

              <div className="result-card">
                <div className="result-header">
                  <h2>Hashtags</h2>
                  <CopyButton text={hashtagString} />
                </div>
                <p className="result-body hashtags">{hashtagString}</p>
              </div>

              <div className="result-card">
                <div className="result-header">
                  <h2>Learning Reflection</h2>
                  <CopyButton text={result.reflection} />
                </div>
                <p className="result-body">{result.reflection}</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
