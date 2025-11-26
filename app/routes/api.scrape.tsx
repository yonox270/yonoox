import type { ActionFunctionArgs } from "react-router";
import axios from "axios";
import * as cheerio from "cheerio";

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
];

const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

// Scraper Amazon
const scrapeAmazon = ($: any) => {
  try {
    const title = $('#productTitle').text().trim();
    let price = $('.a-price-whole').first().text() + $('.a-price-fraction').first().text();
    if (!price) price = $('.a-price .a-offscreen').first().text();
    price = price.replace(/[^0-9.,]/g, '');
    
    const description = $('#feature-bullets').text().trim() || $('#productDescription').text().trim();
    
    const images: string[] = [];
    $('#altImages img, #imageBlock img').each((i: number, elem: any) => {
      let src = $(elem).attr('src');
      if (src && !src.includes('play-icon')) {
        images.push(src.replace(/\._.*_\./, '.'));
      }
    });
    
    if (!title || !price) return null;
    
    return {
      title,
      price,
      description: description?.substring(0, 500) || '',
      images: images.slice(0, 5),
      currency: 'EUR',
      vendor: 'Amazon',
    };
  } catch (e) {
    return null;
  }
};

// Scraper Nike
const scrapeNike = ($: any) => {
  try {
    const title = $('h1').first().text().trim() || $('meta[property="og:title"]').attr('content');
    const price = $('[data-test="product-price"]').text().trim() || $('.product-price').text().trim();
    const description = $('.description-preview').text().trim() || $('meta[property="og:description"]').attr('content');
    
    const images: string[] = [];
    $('img[src*="static.nike.com"]').each((i: number, elem: any) => {
      const src = $(elem).attr('src');
      if (src && !src.includes('logo')) images.push(src);
    });
    
    if (!title) return null;
    
    return {
      title,
      price: price?.replace(/[^0-9.,]/g, '') || '0',
      description: description?.substring(0, 500) || '',
      images: images.slice(0, 5),
      currency: 'EUR',
      vendor: 'Nike',
    };
  } catch (e) {
    return null;
  }
};

// Scraper Shopify
const scrapeShopify = ($: any) => {
  try {
    const productJson = $('script[type="application/ld+json"]').html();
    if (productJson) {
      const data = JSON.parse(productJson);
      if (data['@type'] === 'Product') {
        return {
          title: data.name,
          price: data.offers?.price,
          description: data.description?.substring(0, 500),
          images: Array.isArray(data.image) ? data.image : [data.image].filter(Boolean),
          currency: data.offers?.priceCurrency || 'EUR',
          vendor: data.brand?.name || '',
        };
      }
    }
  } catch (e) {}
  return null;
};

// Scraper universel
const scrapeUniversal = ($: any, url: string) => {
  const title = $('h1').first().text().trim() || $('meta[property="og:title"]').attr('content');
  const price = $('[class*="price"]').first().text().trim() || $('[itemprop="price"]').attr('content');
  const description = $('[class*="description"]').first().text().trim() || $('meta[property="og:description"]').attr('content');
  
  const images: string[] = [];
  $('img[src*="product"], img[class*="product"]').each((i: number, elem: any) => {
    const src = $(elem).attr('src') || $(elem).attr('data-src');
    if (src && !src.includes('logo')) {
      images.push(src.startsWith('//') ? 'https:' + src : src);
    }
  });
  
  if (images.length === 0) {
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) images.push(ogImage);
  }
  
  return {
    title: title || 'Produit',
    price: price?.replace(/[^0-9.,]/g, '') || '0',
    description: description?.substring(0, 500) || '',
    images: images.slice(0, 5),
    currency: 'EUR',
    vendor: new URL(url).hostname.replace('www.', '').replace('.com', '').replace('.fr', ''),
  };
};

// Fonction pour scraper avec ScraperAPI
const fetchWithScraperAPI = async (url: string) => {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) throw new Error("ScraperAPI key missing");
  
  const scraperUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}`;
  const response = await axios.get(scraperUrl, { timeout: 30000 });
  return response;
};

// Fonction principale de scraping
const scrapeProduct = async (url: string, html?: string) => {
  let $: any;
  
  // Si HTML fourni manuellement
  if (html) {
    $ = cheerio.load(html);
  } else {
    // Tentative 1 : Scraping direct
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 15000,
      });
      $ = cheerio.load(response.data);
    } catch (error: any) {
      console.log("❌ Scraping direct échoué, tentative avec ScraperAPI...");
      
      // Tentative 2 : ScraperAPI
      try {
        const response = await fetchWithScraperAPI(url);
        $ = cheerio.load(response.data);
        console.log("✅ ScraperAPI utilisé avec succès");
      } catch (scraperError) {
        throw new Error("Site protégé. Utilisez le mode manuel.");
      }
    }
  }
  
  const hostname = new URL(url).hostname.toLowerCase();
  let productData = null;

  // Détection du site
  if (hostname.includes('amazon')) {
    productData = scrapeAmazon($);
  } else if (hostname.includes('nike')) {
    productData = scrapeNike($);
  } else if (hostname.includes('shopify') || $('meta[name="shopify-checkout-api-token"]').length > 0) {
    productData = scrapeShopify($);
  }
  
  // Fallback universel
  if (!productData || !productData.title || productData.title === 'Produit') {
    productData = scrapeUniversal($, url);
  }

  return productData;
};

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { url, html } = await request.json();
    
    if (!url || !url.startsWith('http')) {
      return Response.json({ error: "URL invalide" }, { status: 400 });
    }

    console.log("🔍 Scraping:", url);

    const productData = await scrapeProduct(url, html);

    if (!productData || !productData.title || productData.title === 'Produit') {
      return Response.json({ 
        error: "Impossible d'extraire les données",
        needsManual: true,
        message: "Site protégé. Utilisez le mode manuel en copiant le code source de la page."
      }, { status: 422 });
    }

    console.log("✅ Produit scrapé:", productData.title);

    return Response.json({ success: true, product: productData });

  } catch (error: any) {
    console.error("❌ Erreur:", error.message);
    
    if (error.message.includes("Site protégé")) {
      return Response.json({ 
        error: error.message,
        needsManual: true 
      }, { status: 403 });
    }

    return Response.json({ 
      error: "Erreur: " + error.message 
    }, { status: 500 });
  }
}