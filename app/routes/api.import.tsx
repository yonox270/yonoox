import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { admin } = await authenticate.admin(request);
    const { product } = await request.json();

    const createProductResponse = await admin.graphql(
      `#graphql
        mutation productCreate($input: ProductInput!) {
          productCreate(input: $input) {
            product {
              id
              title
              handle
            }
            userErrors {
              field
              message
            }
          }
        }`,
      {
        variables: {
          input: {
            title: product.title,
            descriptionHtml: product.description,
            vendor: product.vendor || "Importé",
            productType: "Importé via YONOX",
          },
        },
      }
    );

    const createProductJson = await createProductResponse.json();
    const createResult = createProductJson.data.productCreate;

    if (createResult.userErrors.length > 0) {
      return Response.json({ 
        error: "Erreur création produit", 
        details: createResult.userErrors 
      }, { status: 400 });
    }

    const productId = createResult.product.id;

    const variantResponse = await admin.graphql(
      `#graphql
        mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkCreate(productId: $productId, variants: $variants) {
            productVariants {
              id
              price
            }
            userErrors {
              field
              message
            }
          }
        }`,
      {
        variables: {
          productId: productId,
          variants: [
  {
    price: product.price.toString().replace(/[^0-9.,]/g, '').replace(',', '.'),
  }
],
        },
      }
    );

    if (product.images && product.images.length > 0) {
      const mediaInput = product.images.map((url: string) => ({
        originalSource: url,
        mediaContentType: "IMAGE"
      }));

      await admin.graphql(
        `#graphql
          mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
            productCreateMedia(productId: $productId, media: $media) {
              media {
                ... on MediaImage {
                  id
                }
              }
              mediaUserErrors {
                field
                message
              }
            }
          }`,
        {
          variables: {
            productId: productId,
            media: mediaInput,
          },
        }
      );
    }

    return Response.json({ 
      success: true, 
      product: createResult.product 
    });

  } catch (error: any) {
    return Response.json({ 
      error: "Erreur: " + error.message 
    }, { status: 500 });
  }
}