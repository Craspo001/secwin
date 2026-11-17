# SecWin Thesis Documentation

This directory contains the thesis write-up and documentation for the SecWin project.

## Structure

```
docs/thesis/
├── README.md              # This file
├── chapters/
│   ├── 01_introduction.md
│   ├── 02_background.md
│   ├── 03_architecture.md
│   ├── 04_implementation.md
│   ├── 05_evaluation.md
│   ├── 06_conclusion.md
├── figures/               # Diagrams and charts
├── tables/                # Data tables
├── appendices/
│   ├── appendix_a_tools.md
│   ├── appendix_b_playbooks.md
│   ├── appendix_c_benchmarks.md
├── bibliography.bib
└── thesis.tex             # Main LaTeX file (if using LaTeX)
```

## Building the Thesis

### Using Pandoc (Markdown to PDF)

```bash
# Install pandoc and LaTeX
# Windows: choco install pandoc miktex
# Linux: sudo apt install pandoc texlive-full

# Build PDF
pandoc chapters/*.md -o thesis.pdf --pdf-engine=xelatex \
  --toc --number-sections \
  -V geometry:margin=1in \
  -V fontsize=12pt \
  -V documentclass=report

# Build HTML
pandoc chapters/*.md -o thesis.html --toc --number-sections --standalone
```

### Using Typst (Modern Alternative)

```bash
# Install typst
# cargo install typst-cli

# Build PDF
typst compile thesis.typ thesis.pdf
```

## Chapter Overview

1. **Introduction** - Problem statement, goals, contributions
2. **Background** - Security tooling landscape, Windows challenges, related work
3. **Architecture** - System design, component diagram, data flow
4. **Implementation** - Key algorithms, CLI design, GUI architecture, Tauri integration
5. **Evaluation** - Benchmarks, usability study, comparison with alternatives
6. **Conclusion** - Summary, future work, lessons learned

## Figures

All figures should be placed in `figures/` and referenced as:
```markdown
![Architecture Diagram](../figures/architecture.png)
```

## Tables

Data tables in `tables/` as CSV or Markdown.

## Demo Video

See `demo/` directory for video script and recording instructions.

## Citation

```bibtex
@mastersthesis{secwin2024,
  title={SecWin: Modern Kali Tooling on Windows},
  author={...},
  year={2024},
  school={...}
}
```