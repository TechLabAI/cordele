# Package marker (D-118): makes the scripts/ directory importable as `scripts`
# so pyproject.toml entry_points can target `scripts.techlab:main`.
# Hyphenated script filenames (e.g. new-project.py) are not directly
# importable; the techlab umbrella resolves them via importlib at dispatch
# time.
