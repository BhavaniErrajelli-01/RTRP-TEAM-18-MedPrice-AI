const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8000/api';

const PLATFORM_DEFAULTS = [
    { platform: 'Netmeds', basePrice: 24.0, availability: 'In Stock', urlBuilder: (query) => `https://www.netmeds.com/catalogsearch/result/${encodeURIComponent(query)}/all` },
    { platform: 'Tata 1mg', basePrice: 25.0, availability: 'In Stock', urlBuilder: (query) => `https://www.1mg.com/search/all?name=${encodeURIComponent(query)}` },
    { platform: 'PharmEasy', basePrice: 26.5, availability: 'In Stock', urlBuilder: (query) => `https://pharmeasy.in/search/all?name=${encodeURIComponent(query)}` },
    { platform: 'Apollo Pharmacy', basePrice: 27.5, availability: 'In Stock', urlBuilder: (query) => `https://www.apollopharmacy.in/search-medicines/${encodeURIComponent(query)}` },
];

const ALTERNATIVE_RULES = {
    'dolo 650': [
        { alternative_name: 'Paracetamol 650', composition: 'Paracetamol 650mg' },
        { alternative_name: 'Crocin 650', composition: 'Paracetamol 650mg' },
        { alternative_name: 'Calpol 650', composition: 'Paracetamol 650mg' },
    ],
    paracetamol: [
        { alternative_name: 'Crocin', composition: 'Paracetamol 500mg' },
        { alternative_name: 'Calpol', composition: 'Paracetamol 500mg' },
        { alternative_name: 'Dolo 500', composition: 'Paracetamol 500mg' },
    ],
    crocin: [
        { alternative_name: 'Paracetamol 500', composition: 'Paracetamol 500mg' },
        { alternative_name: 'Dolo 500', composition: 'Paracetamol 500mg' },
        { alternative_name: 'Calpol 500', composition: 'Paracetamol 500mg' },
    ],
    'vitamin c': [
        { alternative_name: 'Limcee', composition: 'Vitamin C 500mg' },
        { alternative_name: 'Celin', composition: 'Ascorbic Acid 500mg' },
        { alternative_name: 'Vitcee', composition: 'Vitamin C 500mg' },
    ],
    cetirizine: [
        { alternative_name: 'Cetzine', composition: 'Cetirizine 10mg' },
        { alternative_name: 'Okacet', composition: 'Cetirizine 10mg' },
    ],
};

const normalizeQuery = (value) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const hashQuery = (query) =>
    [...normalizeQuery(query)].reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0);

const buildFallbackResults = (query) => {
    const seed = Math.abs(hashQuery(query));
    const results = PLATFORM_DEFAULTS.map((item, index) => {
        const variance = ((seed + index * 17) % 9) * 0.37;
        return {
            platform: item.platform,
            price: Number((item.basePrice + variance).toFixed(2)),
            availability: item.availability,
            url: item.urlBuilder(query),
        };
    }).sort((left, right) => left.price - right.price);

    return results.map((item, index) => ({
        ...item,
        best_deal: index === 0,
    }));
};

const buildFallbackSummary = (results = []) => {
    if (!results.length) {
        return {
            best_time_to_buy: 'Not enough data yet to recommend a buying window.',
            price_prediction: 'Not enough data',
            best_platform: null,
            estimated_savings: 0,
            dosage_context: null,
        };
    }

    const sorted = [...results].sort((left, right) => Number(left.price) - Number(right.price));
    const averagePrice = sorted.reduce((total, item) => total + Number(item.price), 0) / sorted.length;

    return {
        best_time_to_buy: 'This is a reasonable time to buy, and an alert can help if you want to wait for a dip.',
        price_prediction: 'Prices look fairly stable in the short term.',
        best_platform: sorted[0]?.platform || null,
        estimated_savings: Number((averagePrice - Number(sorted[0]?.price || 0)).toFixed(2)),
        dosage_context: normalizeQuery(sorted[0]?.url || '').match(/(\d+mg)/)?.[1] || null,
    };
};

const buildFallbackAlternatives = (query) => {
    const normalized = normalizeQuery(query);

    if (ALTERNATIVE_RULES[normalized]) {
        return ALTERNATIVE_RULES[normalized];
    }

    const partialMatch = Object.entries(ALTERNATIVE_RULES).find(
        ([key]) => normalized.includes(key) || key.includes(normalized)
    );

    return partialMatch ? partialMatch[1] : [];
};

const getFriendlyError = (error) => {
    if (error instanceof TypeError) {
        return 'Unable to reach the backend. Make sure the API server is running on http://127.0.0.1:8000.';
    }

    return error?.message || 'Something went wrong';
};

const delay = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const fetchWithTimeout = async (url, options = {}, timeoutMs = 12000) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
        });
    } finally {
        window.clearTimeout(timeoutId);
    }
};

const handleResponse = async (response) => {
    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Something went wrong');
    }
    return response.json();
};

const fetchJsonWithRetry = async (url, options = {}, config = {}) => {
    const {
        retries = 0,
        timeoutMs = 12000,
        retryDelayMs = 800,
    } = config;

    let lastError;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            const response = await fetchWithTimeout(url, options, timeoutMs);
            return await handleResponse(response);
        } catch (error) {
            lastError = error;

            if (attempt === retries) {
                break;
            }

            if (!(error instanceof TypeError) && error?.name !== 'AbortError') {
                break;
            }

            await delay(retryDelayMs * (attempt + 1));
        }
    }

    throw lastError;
};

const api = {
    getBackendHealth: async () => {
        try {
            return await fetchJsonWithRetry('http://127.0.0.1:8000/health', {}, { retries: 1, timeoutMs: 4000, retryDelayMs: 500 });
        } catch (error) {
            return {
                status: 'down',
                services: {
                    supabase: 'unknown',
                    smtp: 'unknown',
                },
                message: getFriendlyError(error),
            };
        }
    },

    searchMedicine: async (query) => {
        try {
            const data = await fetchJsonWithRetry(
                `${API_BASE_URL}/search?query=${encodeURIComponent(query)}`,
                {},
                { retries: 2, timeoutMs: 8000, retryDelayMs: 900 }
            );
            return { ...data, isFallback: false };
        } catch (error) {
            if (error instanceof TypeError || error?.name === 'AbortError') {
                return {
                    query,
                    results: buildFallbackResults(query),
                    summary: buildFallbackSummary(buildFallbackResults(query)),
                    isFallback: true,
                    message: 'Showing available demo pricing for now.',
                };
            }

            throw new Error(getFriendlyError(error));
        }
    },

    searchMedicineBasket: async (queries) => {
        const cleanedQueries = [...new Set((queries || []).map((item) => item.trim()).filter(Boolean))];
        const responses = await Promise.all(cleanedQueries.map((item) => api.searchMedicine(item)));
        return responses.map((response, index) => ({
            query: cleanedQueries[index],
            results: response.results || [],
            summary: response.summary || null,
            isFallback: response.isFallback || false,
        }));
    },

    getAlternatives: async (query) => {
        try {
            return await fetchJsonWithRetry(
                `${API_BASE_URL}/alternatives?query=${encodeURIComponent(query)}`,
                {},
                { retries: 1, timeoutMs: 8000, retryDelayMs: 700 }
            );
        } catch (error) {
            if (error instanceof TypeError || error?.name === 'AbortError') {
                return {
                    query,
                    alternatives: buildFallbackAlternatives(query),
                    isFallback: true,
                };
            }

            throw new Error(getFriendlyError(error));
        }
    },

    sendPriceAlertEmail: async ({ email, medicineName, targetPrice, currentPrice }) => {
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/notify-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    medicine_name: medicineName,
                    target_price: targetPrice,
                    current_price: currentPrice,
                }),
            });
            return handleResponse(response);
        } catch (error) {
            throw new Error(getFriendlyError(error));
        }
    },

    chat: async (messages) => {
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ messages }),
            });
            return handleResponse(response);
        } catch (error) {
            throw new Error(getFriendlyError(error));
        }
    },

    saveMedicine: async (medicineName, token = null) => {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/save`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ medicine_name: medicineName }),
            });
            return handleResponse(response);
        } catch (error) {
            throw new Error(getFriendlyError(error));
        }
    },

    getHistory: async (token = null) => {
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/history`, { headers });
            return handleResponse(response);
        } catch (error) {
            throw new Error(getFriendlyError(error));
        }
    }
};

export default api;
