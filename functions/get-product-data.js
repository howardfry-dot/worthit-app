exports.handler = async function(event) {
    const { productName } = event.queryStringParameters;
    const apiKey = process.env.VALUESERP_API_KEY;

    if (!apiKey) {
        return { statusCode: 500, body: JSON.stringify({ error: "API Key is not configured on Netlify." }) };
    }

    const url = `https://api.valueserp.com/search?api_key=${apiKey}&q=${encodeURIComponent(productName)}&gl=gb&tbm=shop&output=json`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.request_info && data.request_info.success === false) {
             return { statusCode: 500, body: JSON.stringify({ error: `API Error: ${data.request_info.message}` }) };
        }

        // Primary path: Check for perfect shopping results first
        if (data.shopping_results && data.shopping_results.length > 0) {
            const firstProduct = data.shopping_results[0];
            const imageUrl = firstProduct.image;
            const deals = firstProduct.offers ? firstProduct.offers.slice(0, 3).map(offer => ({
                source: offer.seller,
                price: offer.price,
                link: offer.link
            })) : [];

            return {
                statusCode: 200,
                body: JSON.stringify({ imageUrl, deals }),
            };
        }

        // --- NEW Smarter Fallback Logic ---
        // If no shopping results, try to build a result from organic data
        if (data.organic_results && data.organic_results.length > 0) {
            let imageUrl = 'https://placehold.co/600x400/f3f4f6/333333?text=Image\\nNot\\nFound';
            // Try to find a better image from inline_images if they exist
            if(data.inline_images && data.inline_images.length > 0) {
                imageUrl = data.inline_images[0].image;
            }

            // Try to find prices in the organic results
            const deals = data.organic_results
                .filter(result => result.rich_snippet?.top?.detected_extensions?.price)
                .slice(0, 3)
                .map(result => ({
                    source: result.domain.replace('www.', ''),
                    price: result.rich_snippet.top.extensions[0], // Often the price is the first item
                    link: result.link
                }));

            return {
                statusCode: 200,
                body: JSON.stringify({ imageUrl, deals }),
            };
        }
        
        // If there are no results at all, then show the error
        return { statusCode: 404, body: JSON.stringify({ error: "Oops! We couldn't find that product. Please try a different name." }) };

    } catch (error) {
        console.error("Function error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "The backend function failed." }) };
    }
};

