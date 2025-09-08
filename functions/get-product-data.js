exports.handler = async function(event) {
    // Get the product name from the request
    const { productName } = event.queryStringParameters;
    // Securely get your secret API key from Netlify's settings
    const apiKey = process.env.VALUESERP_API_KEY;

    // --- Start of Debugging ---
    console.log("Function started for product:", productName);
    if (!apiKey) {
        console.error("API Key is missing!");
        return { statusCode: 500, body: JSON.stringify({ error: "API Key is not configured on Netlify." }) };
    }
    // --- End of Debugging ---

    const url = `https://api.valueserp.com/search?api_key=${apiKey}&q=${encodeURIComponent(productName)}&gl=gb&output=json`;
    
    // --- More Debugging ---
    console.log("Requesting URL:", url);
    // --- End of Debugging ---

    try {
        const response = await fetch(url);
        const data = await response.json();

        // --- More Debugging ---
        console.log("Received response from ValueSERP:", JSON.stringify(data, null, 2));
        // --- End of Debugging ---


        if (data.request_info && data.request_info.success === false) {
             console.error("ValueSERP API Error:", data.request_info.message);
             return { statusCode: 500, body: JSON.stringify({ error: `API Error: ${data.request_info.message}` }) };
        }


        if (!data.product_results || data.product_results.length === 0) {
            console.warn("No product results found for:", productName);
            return { statusCode: 404, body: JSON.stringify({ error: "Product not found by API." }) };
        }

        const firstProduct = data.product_results[0];
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
        console.error("Catastrophic function error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "The backend function failed completely." }) };
    }
};

