/**
 * GET    /api/paragraphs       — list all paragraphs
 * POST   /api/paragraphs       — add a paragraph
 * PUT    /api/paragraphs?id=N  — update paragraph N
 * DELETE /api/paragraphs?id=N  — delete paragraph N
 *
 * Vercel routes all methods to the same file; we dispatch on req.method.
 */
const store = require('./_store');

module.exports = function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // ── GET ──────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
        return res.status(200).json(store.paragraphs);
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
        const { text } = req.body || {};

        if (!text || typeof text !== 'string' || text.trim().length < 10) {
            return res.status(400).json({ success: false, message: 'Paragraph text must be at least 10 characters' });
        }
        if (text.trim().length > 2000) {
            return res.status(400).json({ success: false, message: 'Paragraph text must be under 2000 characters' });
        }

        const { aiModel = null } = req.body;
        const newId = store.getNextId();
        store.paragraphs.push({ id: newId, text: text.trim(), aiModel });
        return res.status(200).json({ success: true, id: newId });
    }

    // ── PUT ──────────────────────────────────────────────────────────────────
    if (req.method === 'PUT') {
        const id = parseInt(req.query.id);
        const { text } = req.body || {};

        if (!id || isNaN(id)) {
            return res.status(400).json({ success: false, message: 'id query param required' });
        }
        if (!text || typeof text !== 'string' || text.trim().length < 10) {
            return res.status(400).json({ success: false, message: 'Paragraph text must be at least 10 characters' });
        }

        const idx = store.paragraphs.findIndex(p => p.id === id);
        if (idx === -1) {
            return res.status(404).json({ success: false, message: 'Paragraph not found' });
        }

        store.paragraphs[idx].text = text.trim();
        return res.status(200).json({ success: true });
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
        const id = parseInt(req.query.id);

        if (!id || isNaN(id)) {
            return res.status(400).json({ success: false, message: 'id query param required' });
        }

        store.paragraphs = store.paragraphs.filter(p => p.id !== id);
        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
};
