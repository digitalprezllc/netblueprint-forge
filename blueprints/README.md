# blueprints/

Working models produced with the skill in this repository (dogfooding). In a user's own project the same layout lives under `netblueprint/`.

```text
blueprints/
└── <model-name>/
    ├── model.json                 current model
    ├── <model-name>.html          current rendered diagram
    └── archive/
        ├── <model-name>-v1.0.15_2026-10-22T0910.model.json
        ├── <model-name>-v1.0.15_2026-10-22T0910.html
        └── CHANGELOG.md           one entry per revision, by unique name
```

`scripts/archive.mjs` writes the archive entries; nothing is edited without one.
