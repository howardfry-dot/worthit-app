exports.handler = async function(event) {
    const { productName } = event.queryStringParameters;
    const apiKey = process.env.VALUESERP_API_KEY;

    if (!apiKey) {
        return { statusCode: 500, body: JSON.stringify({ error: "API Key is not configured on Netlify." }) };
    }

    // --- FINAL FIX: Added &tbm=shop to specify a Google Shopping search ---
    const url = `https://api.valueserp.com/search?api_key=${apiKey}&q=${encodeURIComponent(productName)}&gl=gb&tbm=shop&output=json`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.request_info && data.request_info.success === false) {
             return { statusCode: 500, body: JSON.stringify({ error: `API Error: ${data.request_info.message}` }) };
        }

        // Now we look for "shopping_results" which is what the shopping API provides
        if (!data.shopping_results || data.shopping_results.length === 0) {
            // As a fallback, check for organic_results if shopping fails
            if (!data.organic_results || data.organic_results.length === 0) {
                 return { statusCode: 404, body: JSON.stringify({ error: "Oops! We couldn't find that product. Please try a different name." }) };
            }
            // Use the first organic result if no shopping results are found
            const firstProduct = data.organic_results[0];
            return {
                statusCode: 200,
                body: JSON.stringify({ imageUrl: 'https://placehold.co/600x400/f3f4f6/333333?text=Image\\nNot\\nFound', deals: [] }),
            };
        }

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

    } catch (error) {
        console.error("Function error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "The backend function failed." }) };
    }
};

