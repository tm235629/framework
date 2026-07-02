---
description: Drop-in company logo folder for the dashboard slice. Instances place their own <company-slug>.svg or .png files here; the Projects/Contacts tabs fall back to a colored monogram on any miss, so this folder may stay empty.
references: None
---

# Company logos (instance-supplied)

The dashboard's Projects and Contacts tabs render a company avatar via
`/logos/<slug>.svg` → `/logos/<slug>.png` → **monogram fallback**. The lookup is
graceful: a 404 silently degrades to a colored monogram (the first letters of the
company name), so this folder is optional.

To brand your instance, drop image files named after the company slug the graph
uses (lowercased, non-alphanumerics collapsed to `-`), e.g. `northstar.png`.

> Instance-Zero note: MetaOptics' live dashboard ships ~37 real company logos here; the slice keeps this folder empty so no MOT brand assets leak into the template.
