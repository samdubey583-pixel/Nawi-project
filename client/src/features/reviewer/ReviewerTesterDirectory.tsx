import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router-dom';

export default function ReviewerTesterDirectory() {
  const [testers, setTesters] = useState<any[]>([]);
  const [instruments, setInstruments] = useState<any[]>([]);
  const [instrumentDetail, setInstrumentDetail] = useState<any>(null);
  const [loadingInstrument, setLoadingInstrument] = useState(false);
  const [searchParams] = useSearchParams();
  const instrumentMode = searchParams.get('view') === 'instruments';
  const selectedTesterId = searchParams.get('testerId') || '';
  const selectedInstrumentId = searchParams.get('instrumentId');
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    setError('');
    setInstrumentDetail(null);
    setInstruments([]);
    setTesters([]);

    const load = async () => {
      try {
        if (!instrumentMode) {
          const response = await axios.get('/reviewer/testers');
          if (current) setTesters(response.data.testers || []);
          return;
        }
        if (selectedInstrumentId) {
          setLoadingInstrument(true);
          const response = await axios.get(`/reviewer/instruments/${encodeURIComponent(selectedInstrumentId)}`);
          if (current) setInstrumentDetail(response.data);
          return;
        }
        if (selectedTesterId) {
          const response = await axios.get(`/reviewer/instruments?testerId=${encodeURIComponent(selectedTesterId)}`);
          if (current) setInstruments(response.data.instruments || []);
        }
      } catch (e: any) {
        if (current) setError(e.response?.data?.message || 'Unable to load the reviewer directory.');
      } finally {
        if (current) setLoadingInstrument(false);
      }
    };

    void load();
    return () => { current = false; };
  }, [instrumentMode, selectedInstrumentId, selectedTesterId]);

  if (instrumentMode && selectedInstrumentId) {
    if (loadingInstrument || (!instrumentDetail && !error)) return <main className="reviewer-page"><div className="reviewer-empty" role="status">Loading instrument record…</div></main>;
    if (!instrumentDetail?.instrument) return <main className="reviewer-page"><header className="reviewer-header"><div><Link to={`/reviewer/testers?view=instruments&testerId=${encodeURIComponent(selectedTesterId)}`}><ArrowLeft size={15} /> Instrument repository</Link><span className="technical-label">INSTRUMENT RECORD</span><h1>Instrument unavailable</h1><p>{error || 'This instrument could not be loaded.'}</p></div></header></main>;

    const instrument = instrumentDetail.instrument;
    return <main className="reviewer-page"><header className="reviewer-header"><div><Link to={`/reviewer/testers?view=instruments&testerId=${encodeURIComponent(selectedTesterId)}`}><ArrowLeft size={15} /> Instrument repository</Link><span className="technical-label">INSTRUMENT RECORD</span><h1>{instrument.typeDesignation || instrument.model}</h1><p>{instrument.manufacturer} · {instrument.serialNumber}</p></div></header>{error && <div className="tare-error" role="alert">{error}</div>}<section className="reviewer-detail-grid"><article className="reviewer-panel"><h2>Metrological characteristics</h2><div className="reviewer-fields">{[['Accuracy class', instrument.accuracyClass], ['Indication type', instrument.indicationType], ['Unit', instrument.unit], ['Min', instrument.min], ['Max', instrument.max], ['e', instrument.e], ['d', instrument.d], ['n', instrument.n]].map(([name, value]) => <div key={String(name)}><small>{name}</small><strong>{value ?? 'Not recorded'}</strong></div>)}</div></article><article className="reviewer-panel"><h2>Test history</h2>{instrumentDetail.reports?.length ? <div className="reviewer-mini-list">{instrumentDetail.reports.map((report: any) => <Link to={`/reviewer/reports/${report.testReportId}`} key={report.id}><span><b>{report.testReportId}</b><small>{String(report.status).replace(/_/g, ' ')} · {report.testerNameSnapshot || 'Tester not recorded'}</small></span><ArrowRight size={15} /></Link>)}</div> : <p className="review-empty">No test reports recorded.</p>}</article></section></main>;
  }

  if (instrumentMode && !selectedTesterId) return <main className="reviewer-page"><header className="reviewer-header"><div><Link to="/reviewer/dashboard"><ArrowLeft size={15} /> Review dashboard</Link><span className="technical-label">REGISTERED INSTRUMENTS</span><h1>Instrument repository</h1><p>Persistent instruments are shown within a selected tester context.</p></div></header><section className="reviewer-section reviewer-context-empty"><div className="reviewer-section-heading"><div><span className="technical-label">REVIEW CONTEXT</span><h2>Please select a tester</h2></div></div><p className="review-empty">Choose a tester from Review Tests before loading their registered instruments.</p><Link className="dashboard-more" to="/reviewer/dashboard"><ArrowLeft size={15} /> Choose a tester</Link></section></main>;

  if (instrumentMode) return <main className="reviewer-page"><header className="reviewer-header"><div><Link to={`/reviewer/dashboard?testerId=${encodeURIComponent(selectedTesterId)}`}><ArrowLeft size={15} /> Review dashboard</Link><span className="technical-label">REGISTERED INSTRUMENTS</span><h1>Instrument repository</h1><p>Persistent instruments and their latest report state for the selected tester.</p></div></header>{error && <div className="tare-error" role="alert">{error}</div>}<section className="reviewer-directory-grid">{instruments.map(instrument => <article className="reviewer-panel reviewer-instrument-card" key={instrument.id}><span className="technical-label">{instrument.accuracyClass || 'Class not recorded'}</span><h2><Link className="reviewer-tester-name" to={`/reviewer/testers?view=instruments&instrumentId=${encodeURIComponent(instrument.id)}&testerId=${encodeURIComponent(selectedTesterId)}`}>{instrument.model}</Link></h2><p>{instrument.manufacturer} · {instrument.serialNumber}</p><div className="reviewer-instrument-meta"><span>Max <b>{instrument.max} {instrument.unit}</b></span><span>e <b>{instrument.e} {instrument.unit}</b></span></div>{instrument.latestReport ? <Link className="reviewer-report-link" to={`/reviewer/reports/${instrument.latestReport.reportNumber}`}><span>{instrument.latestReport.reportNumber}</span><small>{String(instrument.latestReport.status).replace(/_/g, ' ')}</small></Link> : <p className="review-empty">No submitted report.</p>}<Link className="reviewer-open-instrument" to={`/reviewer/testers?view=instruments&instrumentId=${encodeURIComponent(instrument.id)}&testerId=${encodeURIComponent(selectedTesterId)}`}><span>Open instrument record</span><ArrowRight size={15} /></Link></article>)}</section></main>;

  const visibleTesters = selectedTesterId ? testers.filter(tester => tester.id === selectedTesterId) : testers;
  return <main className="reviewer-page"><header className="reviewer-header"><div><Link to="/reviewer/dashboard"><ArrowLeft size={15} /> Review dashboard</Link><span className="technical-label">TESTER DIRECTORY</span><h1>{selectedTesterId ? 'Tester profile' : 'Testers'}</h1><p>Browse persisted tester records and review-visible submissions.</p></div></header>{error && <div className="tare-error" role="alert">{error}</div>}<section className="reviewer-directory-grid">{visibleTesters.map(tester => <article className="reviewer-panel" key={tester.id}><h2><Link className="reviewer-tester-name" to={`/reviewer/testers?testerId=${encodeURIComponent(tester.id)}`}>{tester.name}</Link></h2><p>{tester.email}</p><strong>{tester.reports.length} test record{tester.reports.length === 1 ? '' : 's'}</strong>{tester.reports.length ? <div className="reviewer-mini-list">{tester.reports.map((report: any) => <Link to={`/reviewer/reports/${report.reportNumber}`} key={report.reportNumber}><span><b>{report.reportNumber}</b><small>{report.instrument} · {String(report.status).replace(/_/g, ' ')}</small></span><ArrowRight size={15} /></Link>)}</div> : <p className="review-empty">No test records.</p>}</article>)}</section></main>;
}
