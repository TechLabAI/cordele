# @cordele/imp

Logic layer for the **IMP** module (prototype-first, D-484): facades,
Signal store, Port/Adapter API contracts and TypeScript models. The UI lives in the
Angular prototype; this library is the only injection point the prototype consumes.

Registered as an Nx project by `fe-nx-register-module.py` (D-487).

- `nx lint imp` / `nx test imp` / `nx build imp`
- e2e gate: `nx e2e imp-e2e --list --skipInstall`
