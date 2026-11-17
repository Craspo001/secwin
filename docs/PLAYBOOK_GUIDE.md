# Playbook Guide

Playbooks automate security engagements using a YAML DSL. They orchestrate tools, handle control flow, collect artifacts, and generate reports.

## Quick Start

```bash
# List built-in playbooks
secwin playbook list

# Run a playbook
secwin playbook run external-recon --var target=example.com

# Validate a playbook
secwin playbook validate my-playbook.yaml

# Create a scaffold
secwin playbook init my-engagement
```

## Playbook Structure

```yaml
metadata:
  name: string              # Required: unique identifier
  version: string           # Required: semantic version
  author: string            # Optional
  description: string       # Optional
  mitre_tactics: [string]   # Optional: MITRE ATT&CK tactic IDs
  tags: [string]            # Optional

variables:                  # Optional: input parameters
  target:
    type: string
    required: true
    description: "Target domain"
  rate_limit:
    type: int
    default: 1000

steps:                      # Required: ordered execution steps
  - id: step-id
    name: "Step Name"
    tool: tool-name
    args: [...]
    ...

outputs:                    # Optional: output configuration
  findings: "..."
  report: "..."
  evidence_dir: "..."

hooks:                      # Optional: lifecycle hooks
  pre_step: [...]
  post_step: [...]
  on_failure: [...]
  on_success: [...]
```

## Step Types

### Tool Step (Basic)

```yaml
- id: port_scan
  name: "Port Scan"
  tool: naabu
  args:
    - "-host"
    - "{{.target}}"
    - "-top-ports"
    - "1000"
    - "-o"
    - "{{.output_dir}}/ports.txt"
  artifacts:
    - "{{.output_dir}}/ports.txt"
  mitre_techniques: ["T1595.001"]
  timeout: "10m"
  retry: 2
  continue_on_error: false
```

### Parallel Steps

```yaml
- id: parallel_recon
  name: "Parallel Reconnaissance"
  parallel:
    - id: subdomains
      name: "Subdomain Enum"
      tool: subfinder
      args: ["-d", "{{.target}}", "-o", "{{.output_dir}}/subs.txt"]
    - id: ports
      name: "Port Scan"
      tool: naabu
      args: ["-host", "{{.target}}", "-top-ports", "100"]
    - id: tech
      name: "Tech Detect"
      tool: nuclei
      args: ["-u", "{{.target}}", "-t", "technologies/"]
```

### Foreach Loop

```yaml
- id: fuzz_each
  name: "Fuzz Each Subdomain"
  foreach:
    variable: "subdomain"
    in: "{{.output_dir}}/subdomains.txt"
    steps:
      - id: fuzz
        name: "Fuzz {{.subdomain}}"
        tool: ffuf
        args:
          - "-u"
          - "https://{{.subdomain}}/FUZZ"
          - "-w"
          - "/wordlist.txt"
```

### Conditional (If/Else)

```yaml
- id: conditional_scan
  name: "Conditional Deep Scan"
  if:
    condition: '{{gt (len .findings) 0}}'
    then:
      - id: deep_scan
        name: "Deep Scan"
        tool: nmap
        args: ["-sV", "-sC", "{{.target}}"]
    else:
      - id: skip
        name: "Skip Deep Scan"
        tool: echo
        args: ["No findings, skipping deep scan"]
```

### Try/Catch/Finally

```yaml
- id: risky_operation
  name: "Risky Operation"
  try:
    steps:
      - id: exploit
        name: "Attempt Exploit"
        tool: metasploit
        args: ["-x", "exploit/windows/smb/ms17_010_eternalblue"]
    catch:
      - id: fallback
        name: "Fallback Scan"
        tool: nmap
        args: ["-sV", "{{.target}}"]
    finally:
      - id: cleanup
        name: "Cleanup"
        tool: echo
        args: ["Operation completed"]
```

## Variable System

### Variable Definition

```yaml
variables:
  target:
    type: string
    required: true
    description: "Target domain or IP"
  port_list:
    type: string
    default: "top-1000"
    enum: ["top-100", "top-1000", "all"]
    description: "Port list to scan"
  auth:
    type: object
    required: false
    description: "Authentication credentials"
    secret: true
```

### Variable Types

| Type | Description |
|------|-------------|
| `string` | Text value |
| `int` | Integer |
| `float` | Floating point |
| `boolean` | true/false |
| `object` | Key-value map |
| `array` | List of values |

### Variable Substitution

Use `{{.variable_name}}` in any string field:

```yaml
args:
  - "-target"
  - "{{.target}}"
  - "-output"
  - "{{.output_dir}}/results.txt"
```

Available contexts:
- `.variables.*` — User-provided variables
- `.playbook.metadata.*` — Playbook metadata
- `.step_results.<id>.*` — Results from previous steps
- `.artifacts.*` — Collected artifacts
- `.env.*` — Environment variables

## Artifacts

Artifacts are files produced by steps, automatically collected:

```yaml
artifacts:
  - "{{.output_dir}}/subdomains.txt"
  - "{{.output_dir}}/screenshots/*"
  - "{{.output_dir}}/nuclei.json"
```

Artifacts are:
1. Glob-matched after step completion
2. Stored in evidence locker
3. Available for report generation
4. Referenced in findings

## Control Flow Details

### Parallel Execution

- All parallel steps start simultaneously
- Playbook waits for all to complete
- Failure in any step fails the parallel block (unless `continue_on_error`)

### Foreach Iteration

- Iterates over array or newline-delimited file
- Each iteration gets `.variable` and `.index` in context
- Steps run sequentially per iteration

### Condition Evaluation

Conditions use gjson syntax:

```yaml
condition: '{{.variables.enable_deep_scan}}'                    # Boolean
condition: '{{gt (len .step_results.scan.artifacts) 0}}'       # Length check
condition: '{{eq .variables.auth_type "form"}}'                # String equality
condition: '{{and (gt .variables.rate 100) (lt .variables.rate 1000)}}'  # Logic
```

### Retry Logic

```yaml
retry: 3              # Retry up to 3 times on failure
timeout: "5m"         # Per-attempt timeout
```

### Continue on Error

```yaml
continue_on_error: true   # Don't fail playbook if this step fails
```

## Hooks

Lifecycle hooks for custom actions:

```yaml
hooks:
  pre_step:
    - tool: echo
      args: ["Starting {{.step.name}}"]
  post_step:
    - tool: notify
      args: ["Completed {{.step.name}} in {{.step_result.duration}}"]
  on_failure:
    - tool: slack
      args: ["Playbook failed at {{.step.name}}: {{.error}}"]
  on_success:
    - tool: echo
      args: ["Playbook completed successfully"]
```

Hook context includes `.step`, `.step_result`, `.playbook`, `.variables`.

## Outputs

```yaml
outputs:
  findings: "{{.output_dir}}/findings.json"
  report: "{{.output_dir}}/report.html"
  evidence_dir: "{{.output_dir}}"
```

- `findings`: JSON file with aggregated findings
- `report`: Rendered report (HTML/Markdown/PDF)
- `evidence_dir`: Directory with all artifacts

## Built-in Playbooks

### external-recon.yaml

Full external reconnaissance:
1. Subdomain enumeration (subfinder)
2. DNS resolution (httpx)
3. Port scanning (naabu)
4. Service detection (nmap)
5. Technology fingerprinting (nuclei)
6. HTTP probing (httpx)
7. Screenshots (httpx)
8. Directory fuzzing (ffuf)

### internal-ad-enum.yaml

Active Directory enumeration:
1. BloodHound collection (sharphound)
2. Kerberoasting (crackmapexec)
3. AS-REP roasting (crackmapexec)
4. GPO analysis (crackmapexec)
5. Local admin enumeration (crackmapexec)
6. Password policy (crackmapexec)
7. Privileged groups (crackmapexec)
8. Trust enumeration (crackmapexec)

### web-app-test.yaml

Web application testing:
1. Crawling (httpx)
2. Vulnerability scanning (nuclei)
3. Authentication testing
4. API endpoint discovery (ffuf)
5. Parameter fuzzing (ffuf)
6. Business logic tests
7. JWT testing
8. CORS testing
9. SSL/TLS testing (nmap)

## Custom Playbooks

Save to `playbooks/` or `~/.secwin/playbooks/`:

```bash
secwin playbook run ./my-playbook.yaml --var target=example.com
```

### Best Practices

1. **Idempotent steps**: Re-running shouldn't cause issues
2. **Explicit timeouts**: Prevent hanging
3. **Meaningful IDs**: Used for result referencing
4. **Artifact collection**: Declare all outputs
5. **MITRE tagging**: Map to ATT&CK for reporting
6. **Variable defaults**: Reduce required inputs
7. **Secret handling**: Mark sensitive vars as `secret: true`
8. **Error handling**: Use `continue_on_error` for non-critical steps
9. **Parallel where possible**: Speed up independent operations
10. **Document assumptions**: In `description` fields

## Debugging

```bash
# Dry run (validate + show plan)
secwin playbook run external-recon --var target=example.com --dry-run

# Verbose execution
secwin playbook run external-recon --var target=example.com -v

# Run single step (via playbook with condition)
secwin playbook run external-recon --var target=example.com --var only_step=port_scan
```

## Templating Functions

Available in all string templates:

| Function | Example |
|----------|---------|
| `len` | `{{len .artifacts}}` |
| `gt`, `lt`, `eq`, `ne` | `{{gt .count 10}}` |
| `and`, `or`, `not` | `{{and .a .b}}` |
| `split` | `{{split .list ","}}` |
| `join` | `{{join .array ","}}` |
| `lower`, `upper` | `{{upper .name}}` |
| `replace` | `{{replace .str "old" "new"}}` |
| `now` | `{{now}}` (RFC3339 timestamp) |
| `uuid` | `{{uuid}}` |

## Advanced: Dynamic Steps

Steps can be generated programmatically via hooks (planned):

```yaml
hooks:
  pre_step:
    - tool: generate-steps
      args: ["{{.variables.target}}"]
```

The `generate-steps` tool would output step definitions to inject.