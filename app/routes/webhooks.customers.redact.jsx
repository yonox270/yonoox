import crypto from "crypto";

export const action = async ({ request }) => {
  const hmac = request.headers.get("X-Shopify-Hmac-Sha256");
  const body = await request.text();
  
  const hash = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
    .update(body, "utf8")
    .digest("base64");

  if (hash !== hmac) {
    return new Response("Invalid HMAC", { status: 401 });
  }

  const payload = JSON.parse(body);
  console.log("GDPR: customers/redact", payload);
  
  // TODO: Supprimer les données client
  
  return new Response("OK", { status: 200 });
};