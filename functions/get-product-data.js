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

        // --- FINAL, ROBUST IMAGE & DEAL FINDING ---

        // 1. Get Deals (Reverted to original, more accurate logic)
        if (data.shopping_results && data.shopping_results.length > 0) {
            const firstProduct = data.shopping_results[0];
            if (firstProduct.offers) {
                deals = firstProduct.offers.slice(0, 3).map(offer => ({
                    source: offer.seller,
                    price: offer.price,
                    link: offer.link
                }));
            }
        }

        // 2. Find Image (New, three-step search for best image)
        if (data.shopping_results && data.shopping_results[0]?.image) {
            imageUrl = data.shopping_results[0].image;
        } else if (data.inline_images && data.inline_images[0]?.image) {
            imageUrl = data.inline_images[0].image;
        } else if (data.organic_results) {
            const resultWithImage = data.organic_results.find(result => result.thumbnail);
            if (resultWithImage) {
                imageUrl = resultWithImage.thumbnail;
            }
        }
        
        // 3. Check for any results
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

