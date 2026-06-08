/**
 * In-memory store shared across all serverless function invocations
 * within the same Vercel instance.
 *
 * NOTE: Vercel serverless functions are stateless across cold starts.
 * State resets if the function is cold-started (no traffic for ~5 min).
 * For a live typing competition round this is fine — rounds are short-lived.
 * For persistence across restarts, replace with Vercel KV or a database.
 */

const DEFAULT_PARAGRAPHS = [
    { id: 1, text: 'The quick brown fox jumps over the lazy dog. This sentence contains every letter of the English alphabet at least once.', aiModel: null },
    { id: 2, text: 'Programming is the art of telling another human what one wants the computer to do. Every line of code is a small decision that shapes the final product.', aiModel: null },
    { id: 3, text: 'The internet has fundamentally changed the way people communicate, work, and access information. What once took days to deliver can now be shared in milliseconds across the globe.', aiModel: null }
];

// Singleton state object — module-level variables persist for the lifetime
// of a warm serverless function instance.
const store = {
    paragraphs: DEFAULT_PARAGRAPHS.map(p => ({ ...p })),
    testState: {
        isActive: false,
        selectedParagraphId: null,
        timeLimit: 60,
        startTime: null
    },
    results: [],
    _nextId: DEFAULT_PARAGRAPHS.length + 1
};

store.getNextId = function () {
    return this._nextId++;
};

module.exports = store;
