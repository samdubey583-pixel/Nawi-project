import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router-dom';

type Tester = { id: string; name: string; email: string; reports: unknown[] };

export default function ReviewerEvidenceGallery() {
  const [searchParams] = useSearchParams();
  const selectedTesterId = searchParams.get('testerId') || '';
  const [evidence, setEvidence] = useState<any[]>([]);
  const [testers, setTesters] = useState<Tester[]>([]);
  const [testerFilter, setTesterFilter] = useState('ALL');
  const [error, setError] = useState('');
  const [loadingTesters, setLoadingTesters] = useState(true);
  const [loadingEvidence, setLoadingEvidence] = useState(() => Boolean(selectedTesterId));
  const selectedTester = testers.find(tester => tester.id === selectedTesterId);

  useEffect(() => {
    let active = true;
    axios.get('/reviewer/testers')
      .then(response => { if (active) setTesters(response.data.testers || []); })
      .catch((requestError: any) => { if (active) setError(requestError.response?.data?.message || 'Unable to load the tester directory.'); })
      .finally(() => { if (active) setLoadingTesters(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setTesterFilter('ALL');
    setError('');
    if (!selectedTesterId) {
      setEvidence([]);
      setLoadingEvidence(false);
      return () => { active = false; };
    }
    setLoadingEvidence(true);
    axios.get(`/reviewer/evidence?testerId=${encodeURIComponent(selectedTesterId)}`)
      .then(response => { if (active) setEvidence(response.data.evidence || []); })
      .catch((requestError: any) => { if (active) setError(requestError.response?.data?.message || 'Unable to load the evidence gallery.'); })
      .finally(() => { if (active) setLoadingEvidence(false); });
    return () => { active = false; };
  }, [selectedTesterId]);

  const visibleEvidence = useMemo(() => testerFilter === 'ALL'
    ? evidence
    : evidence.filter(item => (item.testerId || item.testerName || 'UNKNOWN') === testerFilter), [evidence, testerFilter]);
  const testerGroups = useMemo(() => {
    const groups = new Map<string, { key: string; name: string; email: string; count: number }>();
    evidence.forEach(item => {
      const key = item.testerId || item.testerName || 'UNKNOWN';
      const group = groups.get(key) || { key, name: item.testerName || 'Tester not recorded', email: item.testerEmail || '', count: 0 };
      group.count += 1;
      groups.set(key, group);
    });
    return Array.from(groups.values());
  }, [evidence]);

  return <main className="reviewer-page">
    <header className="reviewer-header"><div>
      <Link to={selectedTesterId ? `/reviewer/dashboard?testerId=${encodeURIComponent(selectedTesterId)}` : '/reviewer/dashboard'}><ArrowLeft size={15} /> Review dashboard</Link>
      <span className="technical-label">EVIDENCE GALLERY</span>
      <h1>{selectedTester ? `${selectedTester.name}'s evidence` : 'Evidence by tester'}</h1>
      <p>Browse supporting records from reports submitted by each tester.</p>
    </div></header>
    {error && <div className="tare-error" role="alert">{error}</div>}

    {!selectedTesterId ? <section className="reviewer-section">
      <div className="reviewer-section-heading"><div><span className="technical-label">TESTER DIRECTORY</span><h2>Select a tester</h2></div><span>{testers.length} tester{testers.length === 1 ? '' : 's'}</span></div>
      {loadingTesters ? <div className="reviewer-empty">Loading testers…</div> : testers.length ? <div className="reviewer-directory-grid reviewer-dashboard-testers">
        {testers.map(tester => <Link className="reviewer-panel reviewer-tester-card" to={`/reviewer/evidence?testerId=${encodeURIComponent(tester.id)}`} key={tester.id}>
          <span className="technical-label">TESTER · {tester.reports.length} REPORT{tester.reports.length === 1 ? '' : 'S'}</span>
          <h2>{tester.name || 'Tester'}</h2><p>{tester.email}</p><span className="dashboard-more">View evidence <ArrowRight size={15} /></span>
        </Link>)}
      </div> : <div className="reviewer-empty">No testers with report history are available.</div>}
    </section> : <>
      <section className="reviewer-section evidence-tester-filters">
        <div className="reviewer-section-heading"><div><span className="technical-label">TESTER FILTER</span><h2>{selectedTester?.name || 'Selected tester'}</h2></div><span>{loadingEvidence ? 'Loading…' : `${evidence.length} evidence item${evidence.length === 1 ? '' : 's'}`}</span></div>
        <div className="evidence-tester-filter-list">
          <button type="button" className={testerFilter === 'ALL' ? 'selected' : ''} onClick={() => setTesterFilter('ALL')}>All evidence <b>{loadingEvidence ? '…' : evidence.length}</b></button>
          {testerGroups.map(group => <button type="button" className={testerFilter === group.key ? 'selected' : ''} onClick={() => setTesterFilter(group.key)} key={group.key}>{group.name}{group.email && <small>{group.email}</small>}<b>{group.count}</b></button>)}
          <Link className="dashboard-more" to="/reviewer/evidence">Change tester <ArrowRight size={15} /></Link>
        </div>
      </section>
      {loadingEvidence ? <div className="reviewer-empty">Loading evidence…</div> : visibleEvidence.length ? <section className="reviewer-evidence-grid" aria-label="Evidence items">
        {visibleEvidence.map((item, index) => <article className="reviewer-evidence-card" key={item.id}>
          {item.mimeType?.startsWith('image/') && <a className="reviewer-evidence-image-link" href={`/api${item.fileUrl}`} target="_blank" rel="noreferrer" aria-label={`Open image evidence: ${item.label}`}><img className="reviewer-evidence-preview" src={`/api${item.fileUrl}`} alt={item.label || `Evidence for ${item.reportNumber}`} loading="lazy" /></a>}
          <span className="technical-label">Evidence {String(index + 1).padStart(2, '0')} · {item.testerName || selectedTester?.name || 'Tester not recorded'}</span>
          <h2>{item.label}</h2><p>{item.reportNumber} · {item.instrument}</p>
          <small>{item.testId || 'Report'} · {item.testerEmail || selectedTester?.email || 'Tester account not recorded'} · {new Date(item.capturedAt).toLocaleString()}</small>
          {item.caption && <small>{item.caption}</small>}
          <a href={`/api${item.fileUrl}`} target="_blank" rel="noreferrer">Open evidence <ExternalLink size={14} /></a>
        </article>)}
      </section> : <section className="reviewer-section"><div className="reviewer-empty">No evidence is attached to this tester’s submitted reports.</div></section>}
    </>}
  </main>;
}
