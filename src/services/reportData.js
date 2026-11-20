/**
 * Clarivo report / findings data access.
 *
 * Client users may only read reports for their own client organisation, and the
 * Firestore rules enforce that — so every query a client runs MUST filter on
 * clientOrgId, or Firestore rejects the whole query.
 */

import {
  collection, doc, getDocs, query, where, updateDoc, serverTimestamp, arrayUnion,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { isClientRole } from '../config/roles'

export const REMEDIATION_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'remediated', label: 'Remediated' },
  { value: 'risk_accepted', label: 'Risk Accepted' },
]

export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info']

/** Reports visible to this user (all for firm staff, own org only for clients). */
export async function loadVisibleReports(tenantId, profile) {
  const ref = collection(db, 'tenants', tenantId, 'reports')
  if (isClientRole(profile?.role)) {
    if (!profile.clientOrgId) return []
    const snap = await getDocs(query(ref, where('clientOrgId', '==', profile.clientOrgId)))
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }
  const snap = await getDocs(ref)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/** All findings across the given reports, each tagged with its report. */
export async function loadFindingsForReports(tenantId, reports) {
  const perReport = await Promise.all(reports.map(async (r) => {
    try {
      const snap = await getDocs(collection(db, 'tenants', tenantId, 'reports', r.id, 'findings'))
      return snap.docs.map(d => ({
        ...d.data(),
        id: d.id,
        reportId: r.id,
        reportTitle: r.title,
        clientOrg: r.clientOrg || '',
        clientOrgId: r.clientOrgId || null,
      }))
    } catch (err) {
      console.warn('[Clarivo] Could not load findings for report', r.id, err.message)
      return []
    }
  }))
  return perReport.flat().sort((a, b) =>
    SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
}

/** Update a finding's remediation workflow fields and append to its history. */
export async function updateFindingRemediation(tenantId, finding, changes, userEmail) {
  const ref = doc(db, 'tenants', tenantId, 'reports', finding.reportId, 'findings', finding.id)
  const update = { ...changes, updatedAt: serverTimestamp(), updatedBy: userEmail || null }
  if (changes.remediationStatus && changes.remediationStatus !== finding.remediationStatus) {
    update.statusHistory = arrayUnion({
      from: finding.remediationStatus || 'open',
      to: changes.remediationStatus,
      by: userEmail || null,
      at: new Date().toISOString(),
    })
  }
  await updateDoc(ref, update)
}

/** Counts by remediation status. */
export function summarizeRemediation(findings) {
  const s = { open: 0, in_progress: 0, remediated: 0, risk_accepted: 0, total: findings.length }
  findings.forEach(f => {
    const k = f.remediationStatus || 'open'
    s[k] = (s[k] || 0) + 1
  })
  return s
}
