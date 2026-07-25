import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTransactions from "./tools/list-transactions";
import getTransaction from "./tools/get-transaction";
import getRates from "./tools/get-rates";
import listNotifications from "./tools/list-notifications";

// The OAuth issuer MUST be the direct Supabase host. On publish, SUPABASE_URL is
// rewritten to the `.lovable.cloud` proxy, which mcp-js rejects (issuer mismatch).
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "vip-remesas-mcp",
  title: "VIP Remesas",
  version: "0.1.0",
  instructions:
    "Herramientas para consultar remesas, tasas y notificaciones del usuario autenticado en VIP Remesas.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listTransactions, getTransaction, getRates, listNotifications],
});
