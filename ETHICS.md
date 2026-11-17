# Ethics Policy

SecWin is a **defensive security toolchain** for authorized security testing. This policy defines acceptable use and contributor obligations.

## Purpose

SecWin helps security professionals:
- Manage tool installations consistently
- Automate authorized engagement workflows
- Maintain operational security
- Generate evidence-based reports

It does **not** add offensive capabilities — it orchestrates existing tools.

## Acceptable Use

### ✅ Authorized Activities

- **Penetration testing** with written scope and rules of engagement
- **Red team exercises** with organizational authorization
- **Vulnerability assessment** with asset owner permission
- **Security research** on owned/authorized systems
- **CTF competitions** and authorized training platforms
- **Educational labs** with isolated environments
- **Defensive validation** of detection rules

### ❌ Prohibited Activities

- **Unauthorized access** to systems or networks
- **Credential stuffing** or password spraying without permission
- **Lateral movement** outside authorized scope
- **Data exfiltration** beyond what's permitted
- **Persistence** installation without authorization
- **Denial of service** testing without explicit approval
- **Social engineering** without written consent
- **Supply chain attacks** or dependency confusion
- **Any activity violating** CFAA, CMA, GDPR, or local laws

## User Responsibilities

### Before Every Engagement

1. **Obtain written authorization** — Scope, ROE, emergency contacts
2. **Create OpSec profile** — Isolate engagement (`secwin profile engage`)
3. **Verify tool versions** — `secwin list --installed`
4. **Check legal jurisdiction** — Laws vary by country/state

### During Engagement

1. **Stay within scope** — No pivoting without approval
2. **Document everything** — Evidence locker auto-captures
3. **Respect ROE** — Time windows, excluded systems, noise limits
4. **Communicate findings** — Critical vulns immediately per ROE

### After Engagement

1. **Disengage profile** — `secwin profile disengage`
2. **Verify evidence** — `secwin evidence verify`
3. **Deliver report** — Use SecWin report generator
4. **Archive evidence** — Offline, encrypted, access-controlled
5. **Destroy unnecessary data** — Per retention policy

## Contributor Obligations

### Manifest Authors

- **Verify licensing** — Only include tools with clear licenses
- **No malware** — No tools designed primarily for harm
- **Checksums required** — All binary downloads
- **Source attribution** — Link to upstream project
- **Version pinning** — Specific versions, not `latest`

### Code Contributors

- **No offensive features** — No exploits, payloads, evasion
- **Defensive focus** — Detection, hardening, analysis
- **Audit dependencies** — `govulncheck` in CI
- **Sign commits** — `git commit -s`

### Playbook Authors

- **Authorized patterns only** — Recon, enum, vuln scanning
- **No exploitation steps** — Unless clearly marked `condition: authorized_exploit`
- **MITRE tagging** — Map to ATT&CK for defender context
- **Destructive actions require explicit opt-in** — `confirm: true`

## Tool Inclusion Criteria

| Criterion | Required |
|-----------|----------|
| Legitimate security use case | ✅ |
| Open source or free license | ✅ |
| Active maintenance | Preferred |
| Community adoption | Preferred |
| No primary malicious purpose | ✅ |
| No evasion/anti-analysis features | ✅ |
| No weaponized exploits | ✅ |

### Excluded Tool Categories

- **RATs/C2 frameworks** (Cobalt Strike, Sliver, Mythic — only via user-provided)
- **Exploit frameworks** (Metasploit included but flagged `wsl_preferred`)
- **Credential theft tools** (Mimikatz — WSL only, flagged)
- **Ransomware simulators** — Excluded
- **DDoS tools** — Excluded
- **Social engineering toolkits** — Excluded

## Legal Compliance

### United States (CFAA)

- No "exceeds authorized access" facilitation
- Tool orchestration ≠ access
- User bears access responsibility

### United Kingdom (CMA)

- No "unauthorized access" enablement
- Profile isolation supports authorization evidence

### European Union (GDPR)

- Evidence locker: personal data minimization
- Right to erasure: `secwin evidence purge`
- DPIA template in `docs/compliance/`

### Export Controls

- No EAR-restricted cryptography added
- Tools may have own export classifications
- User responsible for compliance

## Enforcement

### Violations

- **Manifest removal** — Tools violating policy removed
- **Contributor ban** — Repeated violations
- **User education** — Warnings for edge cases

### Reporting

Email: ethics@secwin.dev

Include:
- Description of concern
- Tool/playbook/commit reference
- Suggested remediation

## Disclaimer

> **SecWin is a tool orchestration framework. It does not grant authorization, create vulnerabilities, or execute attacks. Users are solely responsible for ensuring their activities comply with all applicable laws, regulations, and contractual obligations. The SecWin project and contributors accept no liability for misuse.**

## References

- [PTES Technical Guidelines](http://www.pentest-standard.org/)
- [NIST SP 800-115](https://csrc.nist.gov/publications/detail/sp/800-115/final)
- [MITRE ATT&CK](https://attack.mitre.org/)
- [OWASP Testing Guide](https://owasp.org/www-project-testing-guide/)
- [CREST Code of Conduct](https://www.crest-approved.org/code-of-conduct/)