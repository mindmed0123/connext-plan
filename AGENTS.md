# Project rules

- Tenant query cache: switch the cache scope (`aplicarEscopoEmpresa`) synchronously before publishing `empresaId` to React state — clearing the cache in an effect after children mounted silently cancels their in-flight queries and leaves screens spinning forever.
- Contracts own the obra value: the Obras list shows the sum of non-closed client contracts plus signed addenda, falling back to the budget only when there is no contract — keeps Contratos and Obras consistent.
