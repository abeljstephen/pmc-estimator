# Security Monitor — Rules & Standards

## Severity Definitions

| Level | Meaning |
|-------|---------|
| CRITICAL | Immediate exploitable risk or confirmed credential exposure — blocks any deployment |
| HIGH | Likely exploitable vulnerability requiring fix before next release |
| MEDIUM | Defensive gap that should be addressed this sprint |
| LOW | Best-practice deviation worth tracking but not blocking |
| INFO | Observation with no direct security impact |

## OWASP Mapping (Top 10 2021)

| OWASP | Category | Maps to SEC- tasks |
|-------|----------|--------------------|
| A01 | Broken Access Control | SEC-040, SEC-041, SEC-032 |
| A02 | Cryptographic Failures | SEC-001, SEC-002, SEC-003, SEC-004 |
| A03 | Injection | SEC-010, SEC-011, SEC-012, SEC-013, SEC-033 |
| A04 | Insecure Design | SEC-051 |
| A05 | Security Misconfiguration | SEC-023, SEC-040 |
| A06 | Vulnerable Components | (future: dependency scanning) |
| A07 | Auth / Identity Failures | SEC-003, SEC-041 |
| A08 | Software Integrity Failures | SEC-014 |
| A09 | Logging / Monitoring Failures | SEC-022 |
| A10 | Server-Side Request Forgery | SEC-013 |

## False Positive Guidance

**Anthropic key regex** (`sk-ant-api[0-9A-Za-z-]+`):
- Ignore matches in `.env.example` files (placeholder pattern)
- Ignore matches where the full value ends in `...` (masked)
- Flag everything else — even partial keys

**innerHTML**:
- PASS if the only things assigned are: empty string `''`, static HTML literals
  with no variable interpolation, or values wrapped in `escHtml()`
- FLAG if a template literal or concatenation includes a variable not provably sanitised

**subprocess**:
- PASS if `shell=False` (default) and command is a list literal
- FLAG if `shell=True` regardless of input source
- FLAG if command is constructed with `' '.join(user_input)` or f-string with variable

## Reporting Format

Each finding must include:
```
severity  : CRITICAL|HIGH|MEDIUM|LOW|INFO
check     : task_id (e.g. SEC-002)
owasp     : A0X — Category Name
file      : relative/path/to/file.ext:lineNumber
message   : One-sentence description of the finding
evidence  : The exact code pattern that triggered the finding (≤120 chars)
fix       : Specific remediation step
```

## Self-Check Before Reporting

- [ ] Did I check every file type listed in SECURITY_PLAN.md for each task?
- [ ] Have I distinguished between production code and archive/test code?
- [ ] Are false positives filtered per the guidance above?
- [ ] Is every CRITICAL finding backed by specific file + line evidence?
- [ ] Does each finding reference the correct OWASP category?
- [ ] Have I checked git history for SEC-004 (not just working tree)?
