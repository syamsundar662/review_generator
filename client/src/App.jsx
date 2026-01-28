import { useState, useCallback } from 'react';

// Icons as simple SVG components
const Icons = {
  Document: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Edit: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  Copy: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
  Check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Sparkles: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3L14.5 8.5L20 12L14.5 15.5L12 21L9.5 15.5L4 12L9.5 8.5L12 3Z"/>
    </svg>
  ),
  Analysis: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 21H4.6C4.03995 21 3.75992 21 3.54601 20.891C3.35785 20.7951 3.20487 20.6422 3.10899 20.454C3 20.2401 3 19.9601 3 19.4V3"/>
      <path d="M7 14.5L11.5 10L15 13.5L21 7.5"/>
    </svg>
  ),
  FileText: () => (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Clear: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18"/>
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    </svg>
  ),
};

const PLATFORMS = [
  { id: 'getyourguide', label: 'GetYourGuide' },
  { id: 'viator', label: 'Viator' },
  { id: 'generic', label: 'Generic Partner' },
];

const TONES = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'soft', label: 'Soft & Apologetic' },
  { id: 'firm', label: 'Firm but Polite' },
];

function App() {
  // Form state
  const [rawFeedback, setRawFeedback] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [bookingReference, setBookingReference] = useState('');
  const [platform, setPlatform] = useState('getyourguide');
  const [tourName, setTourName] = useState('');
  const [guideRemarks, setGuideRemarks] = useState('');
  const [mealType, setMealType] = useState('');
  const [tone, setTone] = useState('neutral');

  // Output state
  const [generatedReport, setGeneratedReport] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Toast state
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleGenerate = async () => {
    if (!rawFeedback.trim()) {
      showToast('Please enter the guide feedback', 'error');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rawFeedback,
          customerName,
          bookingReference,
          platform,
          tourName,
          guideRemarks,
          mealType,
          tone,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate report');
      }

      const data = await response.json();
      setGeneratedReport(data.report);
      setAnalysis(data.analysis);
      setMetadata(data.metadata);
      showToast('Report generated successfully');
    } catch (err) {
      setError(err.message);
      showToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedReport) return;

    try {
      await navigator.clipboard.writeText(generatedReport);
      showToast('Copied to clipboard');
    } catch (err) {
      showToast('Failed to copy', 'error');
    }
  };

  const handleClear = () => {
    setRawFeedback('');
    setCustomerName('');
    setBookingReference('');
    setTourName('');
    setGuideRemarks('');
    setMealType('');
    setGeneratedReport('');
    setAnalysis(null);
    setMetadata(null);
    setPlatform('getyourguide');
    setTone('neutral');
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <div className="logo-icon">OA</div>
            <div className="logo-text">
              <h1>Report Generator</h1>
              <span>Ocean Air Travels</span>
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="layout">
          {/* Input Panel */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <div className="panel-title-icon">
                  <Icons.Edit />
                </div>
                Input Feedback
              </div>
            </div>
            <div className="panel-body">
              {/* Raw Feedback */}
              <div className="form-group">
                <label className="form-label">
                  Guide Feedback (WhatsApp Message)
                </label>
                <textarea
                  className="form-textarea form-textarea-large"
                  placeholder="Paste the WhatsApp feedback from the guide here...

Example:
Customer name: Marjorie Martinez
They had lunch included and were disappointed.
They said this is not what we expected from a Michelin star restaurant."
                  value={rawFeedback}
                  onChange={(e) => setRawFeedback(e.target.value)}
                />
              </div>

              <div className="divider" />
              
              <div className="section-title">Optional Details</div>

              {/* Customer Name and Booking Ref */}
              <div className="input-grid">
                <div className="form-group">
                  <label className="form-label">
                    Customer Name <span className="form-label-optional">(optional)</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Marjorie Martinez"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Booking Reference <span className="form-label-optional">(optional)</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., GYG-123456"
                    value={bookingReference}
                    onChange={(e) => setBookingReference(e.target.value)}
                  />
                </div>
              </div>

              {/* Tour Name and Meal Type */}
              <div className="input-grid">
                <div className="form-group">
                  <label className="form-label">
                    Tour Name <span className="form-label-optional">(optional)</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Dubai Desert Safari Premium"
                    value={tourName}
                    onChange={(e) => setTourName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Meal Inclusion <span className="form-label-optional">(optional)</span>
                  </label>
                  <select
                    className="form-select"
                    value={mealType}
                    onChange={(e) => setMealType(e.target.value)}
                  >
                    <option value="">Select meal type...</option>
                    <option value="Local cuisine set menu">Local cuisine set menu</option>
                    <option value="Emirati traditional buffet">Emirati traditional buffet</option>
                    <option value="International buffet">International buffet</option>
                    <option value="BBQ dinner">BBQ dinner</option>
                    <option value="Light refreshments">Light refreshments</option>
                    <option value="Premium dining experience">Premium dining experience</option>
                    <option value="No meal included">No meal included</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Guide Remarks */}
              <div className="form-group">
                <label className="form-label">
                  Additional Guide Remarks <span className="form-label-optional">(optional)</span>
                </label>
                <textarea
                  className="form-textarea"
                  placeholder="Any additional context about customer behavior, punctuality, or expectations..."
                  value={guideRemarks}
                  onChange={(e) => setGuideRemarks(e.target.value)}
                  style={{ minHeight: '80px' }}
                />
              </div>

              <div className="divider" />

              {/* Platform Selection */}
              <div className="form-group">
                <label className="form-label">Platform Format</label>
                <div className="toggle-group">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      className={`toggle-btn ${platform === p.id ? 'active' : ''}`}
                      onClick={() => setPlatform(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone Selection */}
              <div className="form-group">
                <label className="form-label">Report Tone</label>
                <div className="toggle-group">
                  {TONES.map((t) => (
                    <button
                      key={t.id}
                      className={`toggle-btn ${tone === t.id ? 'active' : ''}`}
                      onClick={() => setTone(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divider" />

              {/* Generate Button */}
              <button
                className="btn btn-primary btn-block"
                onClick={handleGenerate}
                disabled={isLoading || !rawFeedback.trim()}
              >
                {isLoading ? (
                  <>
                    <div className="loading-spinner" />
                    Generating Report...
                  </>
                ) : (
                  <>
                    <Icons.Sparkles />
                    Generate Professional Report
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Output Panel */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <div className="panel-title-icon">
                  <Icons.Document />
                </div>
                Generated Report
              </div>
              {generatedReport && (
                <button className="btn btn-secondary" onClick={handleClear}>
                  <Icons.Clear />
                  Clear
                </button>
              )}
            </div>
            <div className="panel-body">
              <div className="output-container">
                {isLoading && (
                  <div className="loading-overlay">
                    <div className="loading-spinner" />
                    <div className="loading-text">Crafting your professional report...</div>
                  </div>
                )}

                {!generatedReport && !isLoading ? (
                  <div className="output-placeholder">
                    <Icons.FileText />
                    <h3>No Report Generated Yet</h3>
                    <p>
                      Paste the guide feedback on the left and click generate to create a professional partner report.
                    </p>
                  </div>
                ) : (
                  <>
                    <textarea
                      className="output-textarea"
                      value={generatedReport}
                      onChange={(e) => setGeneratedReport(e.target.value)}
                      placeholder="Your generated report will appear here..."
                    />
                    
                    {metadata && (
                      <div className="metadata">
                        <div className="metadata-item">
                          Platform: {metadata.platform}
                        </div>
                        <div className="metadata-item">
                          Tone: {metadata.tone}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {generatedReport && (
                <>
                  <div className="actions-bar">
                    <button className="btn btn-primary" onClick={handleCopy}>
                      <Icons.Copy />
                      Copy to Clipboard
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={handleGenerate}
                      disabled={isLoading}
                    >
                      <Icons.Sparkles />
                      Regenerate
                    </button>
                  </div>

                  {/* Analysis Card */}
                  {analysis && (
                    <div className="analysis-card">
                      <div className="analysis-title">
                        <Icons.Analysis />
                        Smart Analysis
                      </div>
                      <div className="analysis-grid">
                        <div className="analysis-item">
                          <div className="analysis-item-label">Food Issues</div>
                          <div className={`analysis-item-value ${analysis.foodIssues ? 'negative' : 'positive'}`}>
                            {analysis.foodIssues ? 'Detected' : 'None detected'}
                          </div>
                        </div>
                        <div className="analysis-item">
                          <div className="analysis-item-label">Customer Behavior</div>
                          <div className="analysis-item-value">{analysis.customerBehavior}</div>
                        </div>
                        <div className="analysis-item">
                          <div className="analysis-item-label">Expectation Mismatch</div>
                          <div className="analysis-item-value">{analysis.expectationMismatch}</div>
                        </div>
                        <div className="analysis-item">
                          <div className="analysis-item-label">Guide Response</div>
                          <div className="analysis-item-value">{analysis.guideResponse}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'success' ? <Icons.Check /> : null}
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default App;
