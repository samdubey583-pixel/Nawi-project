export function reviewerSelectionStorageKey(reviewerId: string | undefined) {
  return reviewerId ? `nawi.reviewer.selectedTesterId:${reviewerId}` : 'nawi.reviewer.selectedTesterId:anonymous';
}

export function reviewerNotificationTesterName(snapshotName: string | undefined, selectedTester?: { name?: string }) {
  return selectedTester?.name || snapshotName || 'Tester';
}
