import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Check, Camera, RotateCcw, Upload, X } from 'lucide-react';
import { useParams } from 'react-router-dom';
import './evidence.css';

type MobileSession = { id: string; label: string; testName?: string; reportNumber?: string; instrument?: string; status: string; expiresAt: string };

const readDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error('Unable to read this photo.'));
  reader.readAsDataURL(file);
});

export default function MobileEvidencePage() {
  const { token = '' } = useParams();
  const [session, setSession] = useState<MobileSession | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const response = await axios.get(`/evidence/mobile/${encodeURIComponent(token)}`);
      setSession(response.data.session);
      setError('');
    } catch (e: any) {
      setError(e.response?.data?.message || 'This evidence session is unavailable.');
    }
  };
  useEffect(() => { if (token) void load(); }, [token]);

  const chooseFile = (next: File | undefined) => {
    if (!next) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) { setError('Choose a JPEG, PNG, or WebP photo.'); return; }
    if (next.size > 5 * 1024 * 1024) { setError('Photo must be smaller than 5 MB.'); return; }
    setError(''); setMessage(''); setFile(next); setPreview(URL.createObjectURL(next));
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const data = await readDataUrl(file);
      const response = await axios.post(`/evidence/mobile/${encodeURIComponent(token)}/upload`, { data, mimeType: file.type, originalFilename: file.name, notes });
      setSession(response.data.session); setMessage('Evidence uploaded successfully.'); setFile(null); setPreview(''); setNotes('');
    } catch (e: any) {
      setError(e.response?.data?.message || 'Unable to upload this photo.');
    } finally { setBusy(false); }
  };

  const done = async () => {
    setBusy(true); setError('');
    try { const response = await axios.post(`/evidence/mobile/${encodeURIComponent(token)}/complete`); setSession(response.data.session); setMessage('Evidence uploaded successfully. You can now close this page.'); }
    catch (e: any) { setError(e.response?.data?.message || 'Unable to close the evidence session.'); }
    finally { setBusy(false); }
  };

  const resetCapture = () => { setFile(null); setPreview(''); setNotes(''); setMessage(''); setError(''); };

  if (error && !session) return <main className="mobile-evidence-page"><section className="mobile-evidence-card"><span className="technical-label">NAWI EVIDENCE CAPTURE</span><h1>Evidence session unavailable</h1><p>{error}</p></section></main>;
  if (!session) return <main className="mobile-evidence-page"><section className="mobile-evidence-card"><span className="technical-label">NAWI EVIDENCE CAPTURE</span><h1>Opening secure session…</h1></section></main>;
  const closed = !['ACTIVE', 'UPLOADING'].includes(session.status);
  return <main className="mobile-evidence-page"><section className="mobile-evidence-card">
    <span className="technical-label">NAWI EVIDENCE CAPTURE</span><h1>{session.label || 'Supporting evidence'}</h1>
    <div className="mobile-evidence-context"><span>{session.reportNumber || 'Linked report'}</span><span>{session.testName || 'Report evidence'}</span><span>{session.instrument || 'Linked instrument'}</span></div>
    {error && <div className="mobile-evidence-error">{error}</div>}
    {message && <div className="mobile-evidence-success"><Check size={17} /> {message}</div>}
    {closed ? <div className="mobile-evidence-closed"><Check size={28} /><strong>This evidence session is {session.status.toLowerCase()}.</strong><span>You can now close this page.</span></div> : !preview ? <>
      <button className="mobile-evidence-primary" onClick={() => inputRef.current?.click()}><Camera size={19} /> Take Photo</button>
      <input ref={inputRef} className="evidence-file-input" type="file" accept="image/*" capture="environment" onChange={event => { chooseFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
      <p className="mobile-evidence-help">The photo will be attached to this report and test automatically.</p>
    </> : <>
      <img className="mobile-evidence-preview" src={preview} alt="Selected evidence preview" />
      <label className="mobile-evidence-notes">Optional notes<textarea rows={3} value={notes} onChange={event => setNotes(event.target.value)} placeholder="What does this image show?" /></label>
      <div className="mobile-evidence-actions"><button className="mobile-evidence-secondary" onClick={resetCapture} disabled={busy}><RotateCcw size={16} /> Retake</button><button className="mobile-evidence-primary" onClick={() => void upload()} disabled={busy}><Upload size={16} /> {busy ? 'Uploading…' : 'Upload Evidence'}</button></div>
    </>}
    {!closed && !file && !message && <button className="mobile-evidence-close" onClick={() => void done()} disabled={busy}><X size={15} /> Done</button>}
    {!closed && message && <button className="mobile-evidence-primary mobile-capture-another" onClick={resetCapture}><Camera size={17} /> Capture Another</button>}
  </section></main>;
}
