# Frontend structure

`client/src/app/main.tsx` owns the browser entrypoint and route table. `AuthProvider` owns session hydration and logout. Feature UI is kept with its business feature; clause-specific test workspaces are under `client/src/testing/a4`, `a5`, and `a6`.

Ambient motion is shared in `client/src/shared/components/ambient`, while login and dashboard compositions remain selected by the component variant. Global palette and typography remain in `client/src/styles/globals.css`; feature and test styles stay beside their owners.
