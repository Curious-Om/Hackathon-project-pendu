/**
 * GET    /api/results   — list all results (newest first)
 * POST   /api/results   — submit a result (calculates scoring server-side)
 * DELETE /api/results   — clear all results
 */
const store = require('./_store');

module.exports = function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // ── GET ──────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
        return res.status(200).json(store.results.slice().sort((a, b) => b.id - a.id));
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
        store.results = [];
        return res.status(200).json({ success: true });
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
        const { participantName, typedText, timeTaken } = req.body || {};

        if (!participantName || typeof participantName !== 'string' || participantName.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid participant name' });
        }
        if (typeof typedText !== 'string') {
            return res.status(400).json({ success: false, message: 'Invalid typed text' });
        }
        if (typeof timeTaken !== 'number' || timeTaken <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid time taken' });
        }

        const paragraph = store.paragraphs.find(p => p.id === store.testState.selectedParagraphId);
        if (!paragraph) {
            return res.status(400).json({ success: false, message: 'No active test paragraph found' });
        }

        const originalText = paragraph.text;

        // Calculate character-level accuracy
        let correctChars = 0;
        const minLength = Math.min(typedText.length, originalText.length);
        for (let i = 0; i < minLength; i++) {
            if (typedText[i] === originalText[i]) correctChars++;
        }
        const accuracy = originalText.length > 0 ? (correctChars / originalText.length) * 100 : 0;

        // Speed metrics
        const timeInMinutes = timeTaken / 60;
        const wpm = timeInMinutes > 0 ? Math.round((typedText.length / 5) / timeInMinutes) : 0;
        const cpm = timeInMinutes > 0 ? Math.round(typedText.length / timeInMinutes) : 0;

        // Final score: 60% accuracy + 40% speed (speed capped at 100 WPM equiv)
        const speedScore = Math.min(wpm / 100, 1) * 100;
        const finalScore = Math.round(accuracy * 0.6 + speedScore * 0.4);

        const result = {
            id: Date.now(),
            participantName: participantName.trim(),
            wpm,
            cpm,
            accuracy: Math.round(accuracy * 100) / 100,
            finalScore,
            timestamp: new Date().toISOString()
        };

        store.results.push(result);
        return res.status(200).json({ success: true, result });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
};
