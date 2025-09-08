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

        let imageUrl = 'https://placehold.co/600x400/f3f4f6/333333?text=Image\\nNot\\nFound';
        let deals = [];

        // --- NEW, MORE ROBUST IMAGE & DEAL FINDING ---

        // Primary path: Try to get data from shopping_results first
        if (data.shopping_results && data.shopping_results.length > 0) {
            const firstProduct = data.shopping_results[0];
            if(firstProduct.image) imageUrl = firstProduct.image;
            
            if (firstProduct.offers) {
                deals = firstProduct.offers.slice(0, 3).map(offer => ({
                    source: offer.seller,
                    price: offer.price,
                    link: offer.link
                }));
            }
        } 
        // Fallback path: If no shopping results, try to build from organic data
        else if (data.organic_results && data.organic_results.length > 0) {
            // Find the first available image from any organic result that has a thumbnail
            const resultWithImage = data.organic_results.find(result => result.thumbnail);
            if (resultWithImage) {
                imageUrl = resultWithImage.thumbnail;
            }

            // Find prices in the organic results
            deals = data.organic_results
                .filter(result => result.rich_snippet?.top?.detected_extensions?.price)
                .slice(0, 3)
                .map(result => ({
                    source: result.domain.replace('www.', ''),
                    price: result.rich_snippet.top.extensions[0],
                    link: result.link
                }));
        }

        // If after all that, we still have no deals and no real image, then error.
        if (deals.length === 0 && imageUrl.startsWith('https://placehold.co')) {
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

