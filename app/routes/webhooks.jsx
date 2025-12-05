import { authenticate } from "../shopify.server";
import crypto from "crypto";

export const action = async ({ request }) => {
  const topic = request.headers.get("X-Shopify-Topic");
  
  // Vérification HMAC
  const hmac = request.headers.get("X-Shopify-Hmac-Sha256");
  const body = await request.text();
  
  const hash = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
    .update(body, "utf8")
    .digest("base64");

  if (hash !== hmac) {
    return new Response("Invalid HMAC", { status: 401 });
  }

  // Traitement des webhooks GDPR
  const payload = JSON.parse(body);

  switch (topic) {
    case "customers/data_request":
      console.log("GDPR: Data request received", payload);
      // TODO: Implémenter la logique de récupération des données
      break;
      
    case "customers/redact":
      console.log("GDPR: Customer redact received", payload);
      // TODO: Implémenter la suppression des données client
      break;
      
    case "shop/redact":
      console.log("GDPR: Shop redact received", payload);
      // TODO: Implémenter la suppression des données boutique
      break;
      
    case "app/uninstalled":
      console.log("App uninstalled", payload);
      break;
  }

  return new Response("OK", { status: 200 });
};