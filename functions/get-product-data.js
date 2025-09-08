exports.handler = async function(event) {
    const { productName } = event.queryStringParameters;
    const apiKey = process.env.VALUESERP_API_KEY;

    if (!apiKey) {
        return { statusCode: 500, body: JSON.stringify({ error: "API Key is not configured on Netlify." }) };
    }

    // --- STEP 1: Get Shopping & Deal Data ---
    const shoppingUrl = `https://api.valueserp.com/search?api_key=${apiKey}&q=${encodeURIComponent(productName)}&gl=gb&tbm=shop&output=json`;

    try {
        const shoppingResponse = await fetch(shoppingUrl);
        const shoppingData = await shoppingResponse.json();

        if (shoppingData.request_info && shoppingData.request_info.success === false) {
             return { statusCode: 500, body: JSON.stringify({ error: `API Error: ${shoppingData.request_info.message}` }) };
        }

        let imageUrl = null; // Start with no image
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

        // --- FINAL, FAILSAFE IMAGE LOGIC ---
        // Stage 1: Prioritize high-quality shopping and product images from the initial search.
        if (shoppingData.shopping_results && shoppingData.shopping_results[0]?.image) {
            imageUrl = shoppingData.shopping_results[0].image;
        } else if (shoppingData.product_results?.media && shoppingData.product_results.media[0]?.link) {
            imageUrl = shoppingData.product_results.media[0].link;
        } 
        
        // Stage 2: Fallback to thumbnails in organic results if no primary image is found.
        if (!imageUrl && shoppingData.organic_results) {
            const resultWithThumbnail = shoppingData.organic_results.find(result => result.thumbnail);
            if(resultWithThumbnail) {
                imageUrl = resultWithThumbnail.thumbnail;
            }
        }

        // Stage 3 (Final Failsafe): If still no image, perform a specific Google Images search.
        if (!imageUrl) {
            console.log("No primary image found. Falling back to dedicated Google Images search.");
            const imageUrlSearch = `https://api.valueserp.com/search?api_key=${apiKey}&q=${encodeURIComponent(productName)}&gl=gb&tbm=isch&output=json`;
            const imageResponse = await fetch(imageUrlSearch);
            const imageData = await imageResponse.json();
            if (imageData.image_results && imageData.image_results.length > 0) {
                const firstImage = imageData.image_results.find(img => img.image && img.image.startsWith('https'));
                if (firstImage) imageUrl = firstImage.image;
            }
        }
        
        // Final assignment to placeholder URL if all else fails.
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

