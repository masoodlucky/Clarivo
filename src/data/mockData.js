/**
 * Mock data for Clarivo development.
 * Used by ReportViewer and Dashboard pages.
 */

export const MOCK_REPORT = {
  id: 'report-001',
  title: 'Web Application Penetration Test — Q2 2025',
  engagementType: 'pentest',
  clientOrg: 'Acme Corp',
  version: 2,
  uploadedBy: 'analyst@prudentbit.com',
  uploadedAt: '2025-06-28T14:30:00Z',
  testDates: '2025-04-10 to 2025-04-18',
  scope: 'Production web app at app.acmecorp.com',
  status: 'reviewed',
  fileType: 'pdf',
  fileSizeBytes: 2456789,
  virusScanStatus: 'clean',
  riskScore: 78,
  xai: {
    executiveSummary: `Your web application has significant security vulnerabilities that pose serious business risk. The most critical issue allows attackers to access your customer database without a password — this means all customer data could be stolen in under 10 minutes. Three additional high-severity issues were found that could allow an attacker to take full control of your server.

Immediate action is recommended on the top 2 findings. Your security team at PrudentBit has prepared detailed remediation steps for each vulnerability.`,
    riskScore: 78,
    aiModel: 'mock-v1',
    dualViewEnabled: true,
    executiveViewApproved: true,
    complianceMapping: {
      owasp: ['A03:2021 — Injection', 'A02:2021 — Cryptographic Failures', 'A07:2021 — Auth Failures'],
      nist: ['SI-10', 'SC-28', 'IA-5'],
      iso27001: ['A.14.2.5', 'A.10.1.1'],
      dpdp: ['Section 8 — Data Protection'],
    },
    nvdVerification: {
      checkedAt: '2025-07-01T10:30:00Z',
      totalCVEsFound: 3,
      verified: 2,
      corrected: 1,
      removed: 0,
      hallucinations: [
        {
          cveId: 'CVE-2024-1234',
          type: 'score_mismatch',
          llmStatedScore: 9.8,
          nvdActualScore: 9.1,
          action: 'corrected',
        },
      ],
      lofiMode: false,
      apiResponseMs: 420,
    },
  },
  findings: [
    {
      id: 'f-001',
      title: 'SQL Injection in Login Form',
      severity: 'critical',
      cvssScore: 9.1,
      cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
      cveIds: ['CVE-2024-1234'],
      affectedAsset: 'app.acmecorp.com/login',
      owaspCategory: 'A03:2021 – Injection',
      description:
        'The login form is vulnerable to SQL injection via the username parameter. An unauthenticated attacker can extract the entire database contents using time-based blind SQL injection. The application uses string concatenation for SQL queries instead of parameterised statements.',
      aiExplanation:
        "The login form has a critical flaw that lets an attacker bypass your password protection entirely. Think of it like a bank vault where someone can walk in through the wall instead of the locked door. Anyone on the internet can exploit this — they don't need any password or special access.",
      aiBusinessImpact:
        'An attacker can steal all customer records, payment data, and login credentials within minutes. Under DPDP Act 2023, this could result in fines up to ₹250 crore and mandatory breach notification to all affected users.',
      aiSuggestedRemediation:
        'Use parameterised queries / prepared statements in all database operations. Update the ORM to version 3.2+. Implement input validation with a whitelist approach.',
      remediationStatus: 'open',
      assignedTo: 'dev-team@acmecorp.com',
      trustBadge: 'grounded',
      evidenceRefs: [],
    },
    {
      id: 'f-002',
      title: 'Stored XSS in User Profile',
      severity: 'high',
      cvssScore: 8.0,
      cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:L/A:N',
      cveIds: [],
      affectedAsset: 'app.acmecorp.com/profile',
      owaspCategory: 'A03:2021 – Injection',
      description:
        'Stored XSS vulnerability in the profile biography field. An authenticated user can inject malicious JavaScript that executes in the browser of any user viewing the profile. The application does not perform output encoding on user-supplied HTML content.',
      aiExplanation:
        "Attackers can plant malicious code in user profiles that automatically runs in other users' browsers when they view the profile. It's like putting a hidden trap on a webpage — any visitor triggers it without knowing.",
      aiBusinessImpact:
        'Account takeover of all users who view the infected profile. Potential session hijacking leading to unauthorized access to sensitive client data.',
      aiSuggestedRemediation:
        'Implement strict output encoding for all user-generated content. Deploy Content Security Policy (CSP) headers. Use a sanitisation library like DOMPurify.',
      remediationStatus: 'in_progress',
      assignedTo: 'frontend-team@acmecorp.com',
      trustBadge: 'grounded',
      evidenceRefs: [],
    },
    {
      id: 'f-003',
      title: 'Outdated TLS Configuration on API Server',
      severity: 'medium',
      cvssScore: 5.3,
      cvssVector: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:N/A:N',
      cveIds: ['CVE-2023-4450'],
      affectedAsset: 'api.acmecorp.com',
      owaspCategory: 'A02:2021 – Cryptographic Failures',
      description:
        'TLS 1.0 and TLS 1.1 are still enabled on the API server. These protocols are deprecated and known to be vulnerable to POODLE and BEAST attacks. Modern security standards require TLS 1.2 minimum.',
      aiExplanation:
        "Your API server uses an outdated encryption standard that has known weaknesses. Modern attackers on the same network (e.g., public Wi-Fi) can potentially intercept and read your API communications — including login tokens and sensitive data.",
      aiBusinessImpact:
        'Sensitive API data could be intercepted by attackers on the same network. This is particularly dangerous for mobile app users connecting via public Wi-Fi networks.',
      aiSuggestedRemediation:
        'Disable TLS 1.0 and 1.1 immediately. Enable only TLS 1.2 and 1.3 with modern cipher suites. Configure HSTS headers with a long max-age.',
      remediationStatus: 'remediated',
      assignedTo: 'devops@acmecorp.com',
      trustBadge: 'grounded',
      evidenceRefs: [],
    },
    {
      id: 'f-004',
      title: 'Missing Rate Limiting on Authentication Endpoint',
      severity: 'high',
      cvssScore: 7.5,
      cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N',
      cveIds: [],
      affectedAsset: 'app.acmecorp.com/api/auth',
      owaspCategory: 'A07:2021 – Identification and Authentication Failures',
      description:
        'The authentication API endpoint does not implement rate limiting. An attacker can perform unlimited login attempts, enabling brute-force password attacks against user accounts.',
      aiExplanation:
        "Your login page doesn't limit how many times someone can try passwords. An attacker can use automated tools to try thousands of passwords per second until they find the right one — like trying every key on a keyring at superhuman speed.",
      aiBusinessImpact:
        'Any user account with a weak or commonly-used password is at risk of being compromised via automated brute-force attacks. High-value admin accounts are primary targets.',
      aiSuggestedRemediation:
        'Implement rate limiting (e.g., 5 attempts per minute per IP/account). Add exponential backoff after failed attempts. Consider CAPTCHA after 3 failed attempts.',
      remediationStatus: 'open',
      assignedTo: null,
      trustBadge: 'grounded',
      evidenceRefs: [],
    },
  ],
}

export const MOCK_DASHBOARD_STATS = {
  totalReports: 12,
  activeEngagements: 4,
  openFindings: 23,
  criticalFindings: 3,
  highFindings: 8,
  mediumFindings: 7,
  lowFindings: 5,
  remediationRate: 62,
  avgRiskScore: 71,
  clientOrgs: 5,
  recentActivity: [
    { id: 1, type: 'report_uploaded', title: 'Web App Pentest Report — Q2 2025', user: 'analyst@prudentbit.com', time: '2 hours ago' },
    { id: 2, type: 'finding_resolved', title: 'CVE-2023-4450 marked as remediated', user: 'devops@acmecorp.com', time: '5 hours ago' },
    { id: 3, type: 'xai_generated', title: 'Executive summary generated for Report #12', user: 'system', time: '6 hours ago' },
    { id: 4, type: 'nvd_verified', title: 'NVD verification complete — 3 CVEs verified', user: 'system', time: '6 hours ago' },
    { id: 5, type: 'report_shared', title: 'Report shared with Acme Corp', user: 'firm-admin@prudentbit.com', time: '1 day ago' },
  ],
  riskTrend: [
    { month: 'Jan', score: 85 },
    { month: 'Feb', score: 82 },
    { month: 'Mar', score: 79 },
    { month: 'Apr', score: 78 },
    { month: 'May', score: 74 },
    { month: 'Jun', score: 71 },
  ],
  severityDistribution: [
    { name: 'Critical', value: 3, color: '#FF4D4D' },
    { name: 'High', value: 8, color: '#FF9900' },
    { name: 'Medium', value: 7, color: '#FFD54F' },
    { name: 'Low', value: 5, color: '#00E676' },
  ],
}
