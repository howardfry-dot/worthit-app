// --- Deep Search Helper Function ---
// This function recursively searches the entire API response for a valid image URL.
function findFirstImageUrl(obj) {
    if (typeof obj !== 'object' || obj === null) return null;
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            // Check if the value is a plausible image URL, ignoring tiny data URIs
            if (typeof value === 'string' && value.startsWith('https://') && (value.endsWith('.jpg') || value.endsWith('.png') || value.endsWith('.webp'))) {
                return value;
            }
            // Recurse into nested objects and arrays
            if (Array.isArray(value)) {
                 for (const item of value) {
                    const result = findFirstImageUrl(item);
                    if (result) return result;
                }
            } else if (typeof value === 'object') {
                const result = findFirstImageUrl(value);
                if (result) return result;
            }
        }
    }
    return null;
}

exports.handler = async function(event) {
    const { productName } = event.queryStringParameters;
    const apiKey = process.env.VALUESERP_API_KEY;

    if (!apiKey) {
        return { statusCode: 500, body: JSON.stringify({ error: "API Key is not configured on Netlify." }) };
    }

    const shoppingUrl = `https://api.valueserp.com/search?api_key=${apiKey}&q=${encodeURIComponent(productName)}&gl=gb&tbm=shop&output=json`;

    try {
        const shoppingResponse = await fetch(shoppingUrl);
        const shoppingData = await shoppingResponse.json();

        if (shoppingData.request_info && shoppingData.request_info.success === false) {
             return { statusCode: 500, body: JSON.stringify({ error: `API Error: ${shoppingData.request_info.message}` }) };
        }

        let imageUrl = null;
        let deals = [];

        // --- DEAL LOGIC (PERFECT AND UNCHANGED) ---
        if (shoppingData.shopping_results && shoppingData.shopping_results.length > 0) {
            const firstProduct = shoppingData.shopping_results[0];
            if (firstProduct.offers) {
                deals = firstProduct.offers.slice(0, 3).map(offer => ({
                    source: offer.seller,
                    price: offer.price,
                    link: offer.link
                }));
            }
        }
        if (deals.length === 0 && shoppingData.organic_results) {
            deals = shoppingData.organic_results
                .filter(result => result.rich_snippet?.top?.detected_extensions?.price)
                .slice(0, 3)
                .map(result => ({
                    source: result.domain.replace('www.', ''),
                    price: result.rich_snippet.top.extensions[0],
                    link: result.link
                }));
        }

        // --- DEFINITIVE, FAILSAFE IMAGE LOGIC ---
        // Stage 1: Prioritized Search in common, high-quality locations.
        if (shoppingData.shopping_results && shoppingData.shopping_results[0]?.image) {
            imageUrl = shoppingData.shopping_results[0].image;
        } else if (shoppingData.product_results?.media && shoppingData.product_results.media[0]?.link) {
            imageUrl = shoppingData.product_results.media[0].link;
        }
        
        // Stage 2: Deep Scan of the entire result if no image has been found yet.
        if (!imageUrl) {
            console.log("No primary image found. Performing deep scan of shopping results.");
            imageUrl = findFirstImageUrl(shoppingData);
        }

        // Stage 3 (Final Failsafe): If still no image, perform a specific Google Images search.
        if (!imageUrl) {
            console.log("Deep scan failed. Falling back to dedicated Google Images search.");
            const imageUrlSearch = `https://api.valueserp.com/search?api_key=${apiKey}&q=${encodeURIComponent(productName)}&gl=gb&tbm=isch&output=json`;
            const imageResponse = await fetch(imageUrlSearch);
            const imageData = await imageResponse.json();
            if (imageData.image_results && imageData.image_results.length > 0) {
                const firstImage = imageData.image_results.find(img => img.image && img.image.startsWith('https'));
                if (firstImage) imageUrl = firstImage.image;
            }
        }
        
        if (!imageUrl) {
            imageUrl = 'https://placehold.co/600x400/f3f4f6/333333?text=Image\\nNot\\nFound';
        }

        if (deals.length === 0 && imageUrl.includes('placehold.co')) {
             return { statusCode: 404, body: JSON.stringify({ error: "Oops! We couldn't find that product. Please try a different name." }) };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ imageUrl, deals }),
        };

    } catch (error) {
        console.error("Function error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "The backend function failed." }) };
    }
};
