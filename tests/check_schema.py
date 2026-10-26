"""Validate fixture models against the NetBlueprint JSON Schema (draft 2020-12).

Development check only; the shipped validator is skills/netblueprint-forge/scripts/validate.mjs.
Requires the `jsonschema` package:  pip install jsonschema
or point at a directory that contains it:  python -I tests/check_schema.py --lib <dir>

Exit 0 when every fixture behaves as expected (valid ones pass, invalid-*.json fail).
"""
import json, sys, os, glob

args = sys.argv[1:]
if "--lib" in args:
    i = args.index("--lib")
    sys.path.insert(0, args[i + 1])
    del args[i:i + 2]
from jsonschema import Draft202012Validator, FormatChecker

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEMA = os.path.join(ROOT, "skills", "netblueprint-forge", "assets", "schema", "netblueprint.schema.json")
# Positional arguments are model files to check instead of the fixtures.
FIXTURES = [os.path.abspath(a) for a in args] or sorted(glob.glob(os.path.join(ROOT, "tests", "fixtures", "*.model.json")))

with open(SCHEMA, encoding="utf-8") as f:
    schema = json.load(f)
Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema, format_checker=FormatChecker())
print(f"schema ok: {os.path.relpath(SCHEMA, ROOT)}")

failures = 0
for path in FIXTURES:
    name = os.path.basename(path)
    expect_invalid = name.startswith("invalid-schema-")  # invalid-lint-* fixtures are schema-valid on purpose
    with open(path, encoding="utf-8") as f:
        model = json.load(f)
    errors = sorted(validator.iter_errors(model), key=lambda e: list(e.absolute_path))
    ok = (len(errors) > 0) == expect_invalid
    print(f"{'PASS' if ok else 'FAIL'}  {name}: {len(errors)} error(s){' (expected)' if expect_invalid else ''}")
    if expect_invalid or not ok:
        for e in errors[:25]:
            loc = "/".join(str(p) for p in e.absolute_path) or "<root>"
            print(f"      - {loc}: {e.message[:140]}")
    if not ok:
        failures += 1

sys.exit(1 if failures else 0)
