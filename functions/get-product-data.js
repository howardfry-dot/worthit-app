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

        // --- DEAL & IMAGE FINDING (DEAL LOGIC UNCHANGED) ---

        // 1. Find Live Deals (Logic is unchanged as requested)
        // Prioritize Shopping Results
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
        // Fallback to Organic Results if no deals were found
        if (deals.length === 0 && data.organic_results) {
            deals = data.organic_results
                .filter(result => result.rich_snippet?.top?.detected_extensions?.price)
                .slice(0, 3)
                .map(result => ({
                    source: result.domain.replace('www.', ''),
                    price: result.rich_snippet.top.extensions[0],
                    link: result.link
                }));
        }

        // 2. Find Product Image (New, more robust logic)
        // Attempt 1: Check the primary shopping result first.
        if (data.shopping_results && data.shopping_results[0]?.image) {
            imageUrl = data.shopping_results[0].image;
        } 
        // Attempt 2: If no luck, check for a dedicated product results block.
        else if (data.product_results?.media && data.product_results.media[0]?.link) {
            imageUrl = data.product_results.media[0].link;
        }
        // Attempt 3: If still no luck, check the inline image carousel.
        else if (data.inline_images && data.inline_images.length > 0) {
            const realImage = data.inline_images.find(img => img.image && !img.image.startsWith('data:image/gif'));
            if (realImage) {
                imageUrl = realImage.image;
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

