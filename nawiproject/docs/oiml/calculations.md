# Calculation ownership

Shared calculations are centralized under `server/src/modules/testing/calculations`: MPE rules, mass conversion, scale intervals, compliance, changeover/zero calculations, and tare calculations. Clause services consume these canonical functions; they do not duplicate them.
