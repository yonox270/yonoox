import { useState } from "react";
import { Page, Layout, Card, FormLayout, TextField, Button, Banner, Toast, TextContainer, Frame } from "@shopify/polaris";

export default function Index() {
  const [url, setUrl] = useState("");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showManualMode, setShowManualMode] = useState(false);

  const handleScrape = async (useManual = false) => {
    if (!url) {
      setError("Veuillez entrer une URL");
      return;
    }

    if (useManual && !html) {
      setError("Veuillez coller le code HTML de la page");
      return;
    }

    setScrapeLoading(true);
    setError(null);
    setProduct(null);

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, html: useManual ? html : undefined }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.needsManual) {
          setShowManualMode(true);
          setError(data.error + " Activez le mode manuel ci-dessous.");
        } else {
          setError(data.error);
        }
        return;
      }

      setProduct(data.product);
      setShowManualMode(false);
      setHtml("");
    } catch (err) {
      setError("Erreur: " + err.message);
    } finally {
      setScrapeLoading(false);
    }
  };

  const handleImport = async () => {
    if (!product) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error);
        return;
      }

      setSuccess(true);
      setProduct(null);
      setUrl("");
      setHtml("");
      setShowManualMode(false);
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError("Erreur: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
  <Frame>
    <Page title="YONOX - Import de produits">
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <FormLayout>
                <TextField
                  label="URL du produit"
                  value={url}
                  onChange={setUrl}
                  placeholder="https://www.amazon.fr/dp/..."
                  helpText="Amazon, Nike, Shopify, AliExpress, etc."
                  autoComplete="off"
                />
                
                <Button
                  primary
                  onClick={() => handleScrape(false)}
                  loading={scrapeLoading}
                  disabled={!url || scrapeLoading}
                >
                  Analyser le produit
                </Button>

                {showManualMode && (
                  <>
                    <div style={{ marginTop: "20px", padding: "15px", background: "#f6f6f7", borderRadius: "8px" }}>
                      <TextContainer>
                        <p style={{ fontWeight: "600", marginBottom: "10px" }}>🔒 Site protégé - Mode manuel</p>
                        <p style={{ fontSize: "14px", color: "#666" }}>
                          1. Allez sur la page du produit<br/>
                          2. Appuyez sur <strong>Ctrl+U</strong> (ou clic droit → "Afficher le code source")<br/>
                          3. Copiez tout le code HTML<br/>
                          4. Collez-le dans le champ ci-dessous
                        </p>
                      </TextContainer>
                    </div>

                    <TextField
                      label="Code HTML de la page"
                      value={html}
                      onChange={setHtml}
                      placeholder="Collez le code HTML complet ici..."
                      multiline={4}
                      autoComplete="off"
                    />

                    <Button
                      onClick={() => handleScrape(true)}
                      loading={scrapeLoading}
                      disabled={!html || scrapeLoading}
                    >
                      Analyser avec le code HTML
                    </Button>
                  </>
                )}
              </FormLayout>
            </div>
          </Card>
        </Layout.Section>

        {product && (
          <Layout.Section>
            <Card title="Aperçu du produit">
              <div style={{ padding: "20px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "10px" }}>
                  {product.title}
                </h3>
                <p style={{ color: "#2c6ecb", fontSize: "20px", fontWeight: "bold" }}>
                  {product.price} {product.currency}
                </p>
                <p style={{ marginTop: "10px", color: "#666" }}>
                  Vendeur: {product.vendor}
                </p>
                {product.description && (
                  <p style={{ marginTop: "10px", fontSize: "14px" }}>
                    {product.description.substring(0, 200)}...
                  </p>
                )}
                {product.images && product.images.length > 0 && (
                  <div style={{ marginTop: "15px" }}>
                    <img 
                      src={product.images[0]} 
                      alt={product.title}
                      style={{ maxWidth: "200px", borderRadius: "8px" }}
                    />
                    <p style={{ marginTop: "5px", fontSize: "12px", color: "#666" }}>
                      {product.images.length} image(s)
                    </p>
                  </div>
                )}
                <div style={{ marginTop: "20px" }}>
                  <Button
                    primary
                    onClick={handleImport}
                    loading={loading}
                    disabled={loading}
                  >
                    Importer dans ma boutique
                  </Button>
                </div>
              </div>
            </Card>
          </Layout.Section>
        )}
      </Layout>

      {success && <Toast content="✅ Produit importé !" onDismiss={() => setSuccess(false)} />}
    </Page>
  </Frame>
  );
}