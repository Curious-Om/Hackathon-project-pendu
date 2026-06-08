/**
 * Shared OpenRouter helper for all serverless functions.
 *
 * Design decisions:
 * - System + user prompt split: better instruction-following than single-turn
 * - Ordered model fallback chain: avoids silent failures from rate-limits
 *   or reasoning-only models that return content:null
 * - Prompt injection defence: caller must sanitise topic before passing
 */

const FREE_MODELS = [
    'liquid/lfm-2.5-1.2b-instruct:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemma-4-31b-it:free',
    'meta-llama/llama-3.2-3b-instruct:free'
];

/**
 * Call OpenRouter with automatic model fallback.
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {string} apiKey
 * @param {{ temperature?: number, maxTokens?: number }} options
 * @returns {Promise<{ text: string, model: string }>}
 */
async function callOpenRouter(systemPrompt, userPrompt, apiKey, { temperature = 0.8, maxTokens = 300 } = {}) {
    let lastError = null;

    for (const model of FREE_MODELS) {
        try {
            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://blind-typing-test.vercel.app',
                    'X-Title': 'Blind Typing Test'
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user',   content: userPrompt }
                    ],
                    temperature,
                    max_tokens: maxTokens
                })
            });

            const data = await res.json();

            if (!res.ok) {
                lastError = data?.error?.message || `HTTP ${res.status} from ${model}`;
                console.warn(`[AI] ${model} -> ${res.status}, trying next`);
                continue;
            }

            const text = data?.choices?.[0]?.message?.content?.trim();
            if (!text || text.length < 15) {
                lastError = `${model} returned empty content`;
                console.warn(`[AI] ${model} -> empty content, trying next`);
                continue;
            }

            console.log(`[AI] Success: ${model}`);
            return { text, model };

        } catch (err) {
            lastError = err.message;
            console.warn(`[AI] ${model} -> fetch error: ${err.message}`);
        }
    }

    throw new Error(lastError || 'All AI models failed. Please try again.');
}

module.exports = { callOpenRouter, FREE_MODELS };
