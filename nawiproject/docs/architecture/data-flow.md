# Data flow

The browser calls the API through Axios with the existing `/api` base URL and credentialed cookies. Express authenticates requests through the existing middleware, domain routes load or update Mongoose models, and testing routes call the canonical applicability and calculation services before persisting results. Dashboard views aggregate persisted report and instrument data; they do not own OIML calculations.
