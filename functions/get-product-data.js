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
        // We now perform a dedicated search on Google Images.
        console.log("Performing dedicated Google Images search.");
        const imageUrlSearch = `https://api.valueserp.com/search?api_key=${apiKey}&q=${encodeURIComponent(productName)}&gl=gb&tbm=isch&output=json`;
        const imageResponse = await fetch(imageUrlSearch);
        const imageData = await imageResponse.json();

        if (imageData.image_results && imageData.image_results.length > 0) {
            // Find the first valid image that is a real URL.
            const firstValidImage = imageData.image_results.find(img => img.image && img.image.startsWith('https'));
            if (firstValidImage) {
                imageUrl = firstValidImage.image;
            }
        }
        
        // If all stages fail, assign the placeholder URL so the frontend can show the icon.
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

