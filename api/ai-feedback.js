/**
 * POST /api/ai-feedback
 *
 * Generates personalised post-test coaching feedback using the participant's
 * actual performance data (WPM, accuracy, score). This is the core
 * AI-as-a-feature integration — the app's own data fed back through the model.
 *
 * Rate limited to prevent abuse. Key stays server-side.
 */
const { callOpenRouter } = require('./_openrouter');

const rateLimitStore = new Map();
const RATE_LIMIT_MAX = 20;
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
        return res.status(429).json({ success: false, message: 'Rate limit exceeded. Please wait a moment.' });
    }

    const API_KEY = process.env.OPENROUTER_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({ success: false, message: 'AI service not configured.' });
    }

    const { participantName, wpm, accuracy, finalScore, difficulty } = req.body || {};

    if (!participantName || typeof wpm !== 'number' || typeof accuracy !== 'number') {
        return res.status(400).json({ success: false, message: 'Invalid feedback request data.' });
    }

    // Sanitise name before interpolating into prompt
    const safeName = String(participantName).replace(/['"\\`<>]/g, '').substring(0, 50);
    const diffLabel = difficulty || 'medium';

    const systemPrompt = `You are a supportive typing coach giving brief personalised post-test feedback. Be concise encouraging and specific. Always give one concrete improvement tip. Output exactly 2 sentences no more no less. No greetings no sign-offs.`;

    const userPrompt = `Participant: ${safeName}
Test difficulty: ${diffLabel}
WPM: ${wpm}
Accuracy: ${Number(accuracy).toFixed(1)}%
Final score: ${finalScore}

Benchmarks:
- Beginner: under 30 WPM, under 80% accuracy
- Intermediate: 30-60 WPM, 80-94% accuracy
- Advanced: over 60 WPM, over 95% accuracy

Write 2 sentences of personalised feedback and one specific actionable tip.`;

    try {
        const { text, model } = await callOpenRouter(systemPrompt, userPrompt, API_KEY, {
            temperature: 0.7,
            maxTokens: 120
        });

        return res.status(200).json({ success: true, feedback: text, model });

    } catch (err) {
        console.error('[ai-feedback]', err.message);
        return res.status(502).json({ success: false, message: err.message });
    }
};
