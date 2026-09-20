import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Check, FileImage, ImagePlus, Smartphone, Trash2, X } from 'lucide-react';
import { definitionFor } from './evidenceDefinitions';
import './evidence.css';

type EvidenceContext = { reportId: string; testId?: string; subtestId?: string; instrumentId?: string; category?: string; evidenceType: string; label?: string; title?: string; testName?: string; oimlReference?: string; addLabel?: string; desktopLabel?: string; mobileLabel?: string };
type EvidenceItem = any;
const apiBase = () => String(axios.defaults.baseURL || '').replace(/\/$/, '');
const fileUrl = (item: EvidenceItem) => `${apiBase()}${item.fileUrl || `/evidence/${item.id}/file`}`;

export default function EvidencePanel({ context }: { context: EvidenceContext }) {
  const definition = useMemo(() => definitionFor(context.testId, context.evidenceType), [context.testId, context.evidenceType]);
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [open, setOpen] = useState(false);
  const [viewer, setViewer] = useState<EvidenceItem | null>(null);
  const [session, setSession] = useState<any>(null);
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [note, setNote] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => { try { const response = await axios.get(`/reports/${context.reportId}/evidence`, { params: { testId: context.testId, subtestId: context.subtestId } }); setItems(response.data.evidence || []); } catch { /* Evidence remains unobtrusive if the report is unavailable. */ } };
  useEffect(() => { void load(); }, [context.reportId, context.testId, context.subtestId]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(async () => { try { const response = await axios.get(`/evidence/mobile-session/${session.id}`); setSession(response.data.session); if ((response.data.evidence || []).length > items.length) { setItems(response.data.evidence); setMessage('Evidence received'); } } catch { /* The modal remains usable until expiry. */ } }, 2000);
    return () => window.clearInterval(timer);
  }, [session?.id, items.length]);

  const payload = () => ({ reportId: context.reportId, testId: context.testId || '', subtestId: context.subtestId || '', instrumentId: context.instrumentId || '', category: context.category || definition.category, evidenceType: context.evidenceType, label: context.label || definition.label, title: context.title || definition.label, testName: context.testName || '', oimlReference: context.oimlReference || context.testId || '' });
  const uploadFile = async (file: File) => { if (!file.type.startsWith('image/')) { setMessage('Choose a JPEG, PNG, or WebP image.'); return; } if (file.size > 5 * 1024 * 1024) { setMessage('Images must be smaller than 5 MB.'); return; } setBusy(true); setMessage(''); try { const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Unable to read image.')); reader.readAsDataURL(file); }); await axios.post(`/reports/${context.reportId}/evidence`, { ...payload(), data, mimeType: file.type, originalFilename: file.name, notes: note }); setNote(''); setOpen(false); setMessage('Evidence saved'); await load(); } catch (e: any) { setMessage(e.response?.data?.message || 'Unable to save evidence.'); } finally { setBusy(false); } };
  const createMobileSession = async () => { setBusy(true); setMessage(''); try { const response = await axios.post('/evidence/mobile-session', payload()); const next = response.data.session; setSession(next); setQr(`https://quickchart.io/qr?text=${encodeURIComponent(next.captureUrl)}&size=240&margin=2`); } catch (e: any) { setMessage(e.response?.data?.message || 'Unable to create mobile evidence session.'); } finally { setBusy(false); } };
  const cancelSession = async () => { if (session) await axios.delete(`/evidence/mobile-session/${session.id}`).catch(() => {}); setSession(null); setQr(''); };
  const deleteItem = async (item: EvidenceItem) => { if (!window.confirm('Remove this evidence item?')) return; await axios.delete(`/evidence/${item.id}`); setItems(current => current.filter(entry => entry.id !== item.id)); if (viewer?.id === item.id) setViewer(null); };
  const remaining = session?.expiresAt ? Math.max(0, Math.ceil((new Date(session.expiresAt).getTime() - Date.now()) / 1000)) : 0;

  return <section className="evidence-panel"><div className="evidence-heading"><div><span className="technical-label">SUPPORTING RECORD</span><h2>Evidence</h2><p>Optional supporting photographs and documents</p></div><div className="evidence-heading-actions"><button className="evidence-primary" onClick={() => { setOpen(true); setMessage(''); }}><ImagePlus size={16} /> {context.addLabel || 'Add Evidence'}</button><button className="evidence-secondary" onClick={() => { setOpen(true); setMessage(''); void createMobileSession(); }} disabled={busy}><Smartphone size={16} /> {context.mobileLabel || 'Capture from Phone'}</button></div></div>{message && !open && <div className="evidence-notice"><Check size={15} /> {message}</div>}{items.length > 0 && <div className="evidence-list">{items.map(item => <EvidenceRow item={item} key={item.id} onOpen={() => setViewer(item)} onDelete={() => void deleteItem(item)} />)}</div>}
    {open && <div className="evidence-modal-backdrop" role="presentation"><div className="evidence-modal" role="dialog" aria-modal="true" aria-labelledby="evidence-modal-title"><button className="evidence-close" onClick={() => { if (session) void cancelSession(); else setOpen(false); }} aria-label="Close"><X size={18} /></button><span className="technical-label">EVIDENCE CAPTURE</span><h2 id="evidence-modal-title">Add Evidence</h2><p>{context.label || definition.label}</p>{message && <div className="evidence-error">{message}</div>}{!session ? <><div className="evidence-choice-grid"><button className="evidence-choice" onClick={() => inputRef.current?.click()} disabled={busy}><FileImage size={20} /><strong>{context.desktopLabel || 'Upload from PC'}</strong><small>Select an image from this computer.</small></button><button className="evidence-choice" onClick={() => void createMobileSession()} disabled={busy}><Smartphone size={20} /><strong>Capture from Phone</strong><small>Generate a temporary QR capture session.</small></button></div><input ref={inputRef} className="evidence-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadFile(file); event.currentTarget.value = ''; }} /><label className="evidence-note-field">Optional note<textarea value={note} onChange={event => setNote(event.target.value)} placeholder="What does this image show?" rows={3} /></label></> : <div className="evidence-qr-state"><img src={qr} alt="Scan this QR code with the phone camera" /><strong>{session.status === 'COMPLETED' ? 'Session completed' : message || 'Waiting for phone…'}</strong><span>{remaining ? `Expires in ${Math.floor(remaining / 60).toString().padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}` : 'Session expired'}</span><small>Connect the phone to the same Wi-Fi network as this computer, then scan the code. The phone is already bound to this report and test.</small><button className="evidence-secondary" onClick={() => void cancelSession()}>Cancel session</button></div>}</div></div>}
    {viewer && <EvidenceViewer item={viewer} onClose={() => setViewer(null)} />}
  </section>;
}

function EvidenceRow({ item, onOpen, onDelete }: { item: EvidenceItem; onOpen: () => void; onDelete: () => void }) { return <article className="evidence-row"><button className="evidence-thumb" onClick={onOpen} aria-label={`Open ${item.label || 'evidence'}`}><img src={fileUrl(item)} alt="" /></button><button className="evidence-row-copy" onClick={onOpen}><strong>{item.label || item.originalFilename}</strong><small>{new Date(item.capturedAt || item.createdAt).toLocaleString()} {item.notes ? '· Note attached' : ''}</small></button><button className="evidence-icon-button" onClick={onDelete} aria-label="Delete evidence"><Trash2 size={15} /></button></article>; }
function EvidenceViewer({ item, onClose }: { item: EvidenceItem; onClose: () => void }) { return <div className="evidence-viewer-backdrop" role="presentation" onClick={onClose}><div className="evidence-viewer" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}><button className="evidence-close" onClick={onClose} aria-label="Close"><X size={18} /></button><img src={fileUrl(item)} alt={item.label || 'Evidence'} /><aside><span className="technical-label">EVIDENCE</span><h2>{item.label || item.originalFilename}</h2><p>{item.notes || 'No note added.'}</p><small>{item.oimlReference || item.testId || 'Report-level evidence'} · {new Date(item.capturedAt || item.createdAt).toLocaleString()}</small></aside></div></div>; }
