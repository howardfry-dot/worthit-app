// This is a temporary test function to isolate the image display issue.

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

        // --- IMAGE TEST LOGIC ---
        // We are temporarily forcing a generic image URL to test the frontend.
        const imageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Sony_WH-1000XM3_product_shot.jpg/1920px-Sony_WH-1000XM3_product_shot.jpg';

        if (deals.length === 0) {
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

