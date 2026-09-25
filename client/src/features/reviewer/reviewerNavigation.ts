export type ReviewerNavLabel = 'Review Tests' | 'Registered Instruments' | 'Testers' | 'Reports' | 'Evidence Gallery';

export function isReviewerNavItemActive(label: ReviewerNavLabel, pathname: string, searchParams: URLSearchParams) {
  if (label === 'Registered Instruments') {
    return pathname === '/reviewer/testers' && searchParams.get('view') === 'instruments';
  }
  if (label === 'Testers') {
    return pathname === '/reviewer/testers' && searchParams.get('view') !== 'instruments';
  }
  if (label === 'Review Tests') return pathname === '/reviewer/dashboard';

  const path = label === 'Reports' ? '/reviewer/reports' : '/reviewer/evidence';
  return pathname === path || pathname.startsWith(`${path}/`);
}
