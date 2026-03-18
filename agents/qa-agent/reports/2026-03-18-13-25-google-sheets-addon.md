# QA Report — google-sheets-addon
**Generated**: 2026-03-18 13:25:08  
**Scope**: full  
**Target**: GAS engine + Plot.html (SACO core, copula, optimizer)  
**Files scanned**: 17  
**Static findings**: 9 FAIL · 36 WARN  

---

## Static Findings

- **FAIL** `Plot.html` — id="rowTglFixed" declared 2× — getElementById() returns only the first; event bindings on the duplicate are silently ignored.
- **FAIL** `Plot.html` — id="rowTglAdaptive" declared 2× — getElementById() returns only the first; event bindings on the duplicate are silently ignored.
- **FAIL** `Plot.html` — id="rowTglManual" declared 2× — getElementById() returns only the first; event bindings on the duplicate are silently ignored.
- **FAIL** `Plot.html` — id="seriesToggles" declared 2× — getElementById() returns only the first; event bindings on the duplicate are silently ignored.
- **FAIL** `Plot.html` — id="distTiles" declared 2× — getElementById() returns only the first; event bindings on the duplicate are silently ignored.
- **FAIL** `Plot.html` — id="kpiTriangle" declared 2× — getElementById() returns only the first; event bindings on the duplicate are silently ignored.
- **FAIL** `Plot.html` — id="kpiBeta" declared 2× — getElementById() returns only the first; event bindings on the duplicate are silently ignored.
- **FAIL** `Plot.html` — id="kpiBaseDist" declared 2× — getElementById() returns only the first; event bindings on the duplicate are silently ignored.
- **WARN** `Plot.html` — google.script.run call has no withSuccessHandler — result is discarded silently.
- **WARN** `Plot.html` — google.script.run has withSuccessHandler but no withFailureHandler — server-side errors will fail silently.
- **WARN** `Plot.html` — google.script.run call has no withSuccessHandler — result is discarded silently.
- **WARN** `Plot.html` — google.script.run has withSuccessHandler but no withFailureHandler — server-side errors will fail silently.
- **WARN** `Plot.html` — google.script.run call has no withSuccessHandler — result is discarded silently.
- **WARN** `Plot.html` — google.script.run has withSuccessHandler but no withFailureHandler — server-side errors will fail silently.
- **WARN** `Plot.html` — google.script.run call has no withSuccessHandler — result is discarded silently.
- **WARN** `Plot.html` — google.script.run has withSuccessHandler but no withFailureHandler — server-side errors will fail silently.
- **WARN** `Plot.html` — google.script.run call has no withSuccessHandler — result is discarded silently.
- **WARN** `Plot.html` — google.script.run call has no withSuccessHandler — result is discarded silently.
- **WARN** `Plot.html` — google.script.run has withSuccessHandler but no withFailureHandler — server-side errors will fail silently.
- **WARN** `Plot.html` — google.script.run has withSuccessHandler but no withFailureHandler — server-side errors will fail silently.
- **WARN** `Plot.html` — google.script.run call has no withSuccessHandler — result is discarded silently.
- **WARN** `Plot.html` — google.script.run has withSuccessHandler but no withFailureHandler — server-side errors will fail silently.
- **WARN** `Plot.html` — google.script.run call has no withSuccessHandler — result is discarded silently.
- **WARN** `Plot.html` — google.script.run has withSuccessHandler but no withFailureHandler — server-side errors will fail silently.
- **WARN** `Plot.html` — google.script.run has withSuccessHandler but no withFailureHandler — server-side errors will fail silently.
- **WARN** `Plot.html` — google.script.run has withSuccessHandler but no withFailureHandler — server-side errors will fail silently.
- **WARN** `Plot.html` — google.script.run has withSuccessHandler but no withFailureHandler — server-side errors will fail silently.
- **WARN** `Plot.html` — google.script.run has withSuccessHandler but no withFailureHandler — server-side errors will fail silently.
- **WARN** `Plot.html` — google.script.run has withSuccessHandler but no withFailureHandler — server-side errors will fail silently.
- **WARN** `Plot.html` — google.script.run has withSuccessHandler but no withFailureHandler — server-side errors will fail silently.
- **WARN** `Plot.html` — google.script.run has withSuccessHandler but no withFailureHandler — server-side errors will fail silently.
- **WARN** `Plot.html` — Slider key 'pdf' present in ['STP2_STANCE_META'] but missing from ['sliderIdMap', 'sliderValues()'].
- **WARN** `Plot.html` — Slider key 'triangle' present in ['STP2_STANCE_META'] but missing from ['sliderIdMap', 'sliderValues()'].
- **WARN** `Plot.html` — Slider key 'adaptive' present in ['STP2_STANCE_META'] but missing from ['sliderIdMap', 'sliderValues()'].
- **WARN** `Plot.html` — Slider key 'baseline' present in ['STP2_STANCE_META'] but missing from ['sliderIdMap', 'sliderValues()'].
- **WARN** `Plot.html` — Slider key 'fixedOn' present in ['STP2_STANCE_META'] but missing from ['sliderIdMap', 'sliderValues()'].
- **WARN** `Plot.html` — Slider key 'optimized' present in ['STP2_STANCE_META'] but missing from ['sliderIdMap', 'sliderValues()'].
- **WARN** `Plot.html` — Slider key 'manualOn' present in ['STP2_STANCE_META'] but missing from ['sliderIdMap', 'sliderValues()'].
- **WARN** `Plot.html` — Slider key 'adjusted' present in ['STP2_STANCE_META'] but missing from ['sliderIdMap', 'sliderValues()'].
- **WARN** `Plot.html` — Slider key 'fixed' present in ['STP2_STANCE_META'] but missing from ['sliderIdMap', 'sliderValues()'].
- **WARN** `Plot.html` — Slider key 'baselineOn' present in ['STP2_STANCE_META'] but missing from ['sliderIdMap', 'sliderValues()'].
- **WARN** `Plot.html` — Slider key 'betapert' present in ['STP2_STANCE_META'] but missing from ['sliderIdMap', 'sliderValues()'].
- **WARN** `Plot.html` — Slider key 'adaptiveOn' present in ['STP2_STANCE_META'] but missing from ['sliderIdMap', 'sliderValues()'].
- **WARN** `Plot.html` — Slider key 'manual' present in ['STP2_STANCE_META'] but missing from ['sliderIdMap', 'sliderValues()'].
- **FAIL** `Plot.html` — requestVariant() cache key does not include slider values — moving a Card D slider returns the cached result from the previous slider position instead of re-running the API. Fix: add sliders: window.sliderValues() for variant==='manual'.