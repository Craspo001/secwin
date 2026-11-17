# Report Templates

This directory contains Go templates for generating engagement reports in multiple formats.

## Templates

- `report.html.tmpl` - HTML report template with responsive design, MITRE ATT&CK tagging, and print-friendly CSS
- `report.md.tmpl` - Markdown report template for simple text-based reports

## Template Functions

The following template functions are available:

- `lower` - Convert string to lowercase
- `truncate` - Truncate string to N characters
- `hasPrefix` - Check if string has prefix

## Data Structure

Templates receive the following data structure:

```go
map[string]interface{}{
    "Playbook":    *Playbook,           // Playbook metadata
    "ExecutedAt":  string,              // RFC3339 timestamp
    "Duration":    string,              // Duration string
    "Success":     bool,                // Overall success status
    "Variables":   map[string]interface{}, // User-defined variables
    "Steps":       []map[string]interface{}, // Step results
    "Findings":    []Finding,           // Security findings
    "EvidenceDir": string,              // Evidence directory path
    "Artifacts":   []map[string]interface{}, // Collected artifacts
    "Version":     string,              // SecWin version
}
```

## Step Data Structure

Each step in `Steps` contains:
- `ID` - Step identifier
- `Name` - Human-readable name
- `Tool` - Tool executed
- `Success` - Whether step succeeded
- `Duration` - Execution duration
- `Retries` - Number of retries
- `Error` - Error message if failed
- `Artifacts` - Map of artifact name to path

## Finding Data Structure

Each finding contains:
- `ID` - Finding identifier
- `Title` - Finding title
- `Description` - Detailed description
- `Severity` - critical, high, medium, low, info
- `MITRETechniques` - Slice of MITRE ATT&CK technique IDs
- `Evidence` - Map of evidence references
- `StepID` - Step that generated the finding
- `CreatedAt` - Timestamp

## Artifact Data Structure

Each artifact contains:
- `Name` - Artifact filename
- `Path` - Full path to artifact
- `SHA256` - SHA256 hash
- `Size` - File size in bytes
- `StepID` - Step that produced the artifact
- `Timestamp` - Collection timestamp