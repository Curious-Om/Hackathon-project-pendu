/**
 * POST /api/generate-paragraph
 *
 * Server-side AI proxy for paragraph generation.
 * The OpenRouter API key never reaches the browser.
 *
 * AI design notes:
 * - System + user prompt split for better instruction-following
 * - Difficulty tiers map to reading-level instructions
 * - Few-shot example anchors output format
 * - Prompt injection defence: topic sanitised before interpolation
 * - Model fallback chain handles rate limits and reasoning-model null content
 */
const { callOpenRouter } = require('./_openrouter');

// Simple in-memory rate limiter: { ip -> { count, windowStart } }
const rateLimitStore = new Map();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimit(ip) {
    const now = Date.now();
    const entry = rateLimitStore.get(ip);
    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateLimitStore.set(ip, { count: 1, windowStart: now });
        return true;
    }
    if (entry.count >= RATE_LIMIT_MAX) return false;
    entry.count++;
    return true;
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(ip)) {
        return res.status(429).json({ success: false, message: `Rate limit exceeded. Max ${RATE_LIMIT_MAX} AI generations per minute.` });
    }

    const API_KEY = process.env.OPENROUTER_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({ success: false, message: 'AI service is not configured on the server.' });
    }

    const { topic, includePunctuation, includeNumbers, difficulty } = req.body || {};

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Topic is required' });
    }
    if (topic.trim().length > 100) {
        return res.status(400).json({ success: false, message: 'Topic must be under 100 characters' });
    }

    // Strip quotes, backticks, backslashes — prevents prompt injection
    const safeTopic = topic.trim().replace(/['"\\`]/g, '');

    const systemPrompt = `You are a typing test content generator. Your only job is to output a single plain-text paragraph suitable for a typing speed test. Rules:
- Output ONLY the paragraph. No titles, labels, quotes, markdown, or explanations.
- The paragraph must be 2-4 sentences, between 50 and 80 words.
- It must be factually accurate and grammatically correct.
- It must be interesting and suitable for all ages.`;

    const difficultyInstructions = {
        easy:   'Use simple, everyday words (Grade 4-5 reading level). Keep sentences short and direct. Avoid jargon.',
        medium: 'Use moderately varied vocabulary (Grade 7-8 reading level). Mix short and medium-length sentences.',
        hard:   'Use sophisticated vocabulary, longer complex sentences, and precise terminology (Grade 11+ reading level).'
    };
    const difficultyHint = difficultyInstructions[difficulty] || difficultyInstructions.medium;

    let userPrompt = `Write a typing test paragraph about: ${safeTopic}\n\nDifficulty: ${difficultyHint}`;

    if (includePunctuation === false) {
        userPrompt += '\nPunctuation: Use only periods at sentence ends. No commas, colons, semicolons, or dashes.';
    }
    if (includeNumbers === true) {
        userPrompt += '\nNumbers: Naturally include at least one specific number (a statistic, year, or quantity).';
    }

    userPrompt += `\n\nExample of correct output:\nThe ocean covers more than 70 percent of the Earth surface and contains 97 percent of the planet water. Marine ecosystems support an estimated 700000 to one million species many of which remain undiscovered. The deep ocean below 200 metres is one of the least explored regions on Earth.\n\nNow write the paragraph:`;

    try {
        const { text, model } = await callOpenRouter(systemPrompt, userPrompt, API_KEY);

        const wordCount = text.split(/\s+/).filter(Boolean).length;
        if (wordCount < 10) {
            return res.status(502).json({ success: false, message: 'AI returned too short a paragraph. Try again.' });
        }

        return res.status(200).json({ success: true, text, model });

    } catch (err) {
        console.error('[generate-paragraph]', err.message);
        return res.status(502).json({ success: false, message: err.message });
    }
};
