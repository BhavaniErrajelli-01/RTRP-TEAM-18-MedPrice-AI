const resolveApiBaseUrl = () => {
    const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
    if (configuredBaseUrl) {
        return configuredBaseUrl;
    }

    if (typeof window !== 'undefined') {
        const { origin, hostname } = window.location;
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

        if (isLocalhost) {
            return 'http://127.0.0.1:8000/api';
        }

        return `${origin}/api`;
    }

    return 'http://127.0.0.1:8000/api';
};

const resolveHealthUrl = () => {
    const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
    if (configuredBaseUrl) {
        return configuredBaseUrl.replace(/\/api\/?$/, '') + '/health';
    }

    if (typeof window !== 'undefined') {
        const { origin, hostname } = window.location;
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

        if (isLocalhost) {
            return 'http://127.0.0.1:8000/health';
        }

        return `${origin}/health`;
    }

    return 'http://127.0.0.1:8000/health';
};

const API_BASE_URL = resolveApiBaseUrl();
const HEALTH_URL = resolveHealthUrl();

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

const buildFallbackMetadata = (query) => {
    const normalized = normalizeQuery(query);
    const baseName = normalized
        .replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml)\b/gi, '')
        .replace(/\b\d+\s*(?:tablet|tablets|capsule|capsules|vial|vials)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim() || query;

    const form = normalized.includes('syrup') || normalized.includes('suspension')
        ? 'Syrup'
        : normalized.includes('capsule')
        ? 'Capsule'
        : normalized.includes('drop')
        ? 'Drops'
        : normalized.includes('cream') || normalized.includes('ointment') || normalized.includes('gel')
        ? 'Cream'
        : normalized.includes('injection')
        ? 'Injection'
        : 'Tablet';

    const dosage = query.match(/(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml))/i)?.[1]?.toUpperCase().replace(/\s+/g, '') || null;
    const quantitiesByForm = {
        Tablet: ['10 Tablets', '15 Tablets', '20 Tablets', '30 Tablets'],
        Capsule: ['10 Capsules', '15 Capsules', '30 Capsules'],
        Syrup: ['60 ml', '100 ml', '200 ml'],
        Drops: ['10 ml', '15 ml', '30 ml'],
        Cream: ['15 gm', '20 gm', '30 gm'],
        Injection: ['1 vial', '2 vials'],
    };

    return {
        query,
        metadata: {
            base_name: baseName,
            form,
            dosage,
            quantity: quantitiesByForm[form][0],
            forms: [form],
            dosages: dosage ? [dosage] : ['Not specified'],
            quantities: quantitiesByForm[form],
        },
        isFallback: true,
    };
};

const PRESCRIPTION_NOISE_WORDS = new Set([
    'whatsapp',
    'image',
    'img',
    'jpeg',
    'jpg',
    'png',
    'pdf',
    'camera',
    'scan',
    'photo',
    'document',
    'prescription',
    'pm',
    'am',
    'at',
    'file',
    'upload',
    'note',
    'notes',
    'take',
    'daily',
    'after',
    'before',
    'morning',
    'night',
    'afternoon',
]);

const PRESCRIPTION_KNOWN_ALIASES = {
    'dolo 650': 'Dolo 650 Tablet',
    'glycomet gp1': 'Glycomet GP1 Tablet',
    'glycomet 500': 'Glycomet 500 Tablet',
    'crocin 650': 'Crocin 650 Tablet',
    'pantocid 40': 'Pantocid 40 Tablet',
    'telma 40': 'Telma 40 Tablet',
    'cetirizine 10': 'Cetirizine 10 Tablet',
    'limcee 500': 'Limcee 500 Tablet',
    'paracetamol 650': 'Paracetamol 650 Tablet',
};

const PRESCRIPTION_FORM_WORDS = new Set([
    'tablet', 'tab', 'capsule', 'cap', 'syrup', 'suspension', 'drops', 'drop',
    'cream', 'ointment', 'gel', 'injection', 'inj',
]);

const PRESCRIPTION_SUFFIX_WORDS = new Set([
    'gp1', 'xr', 'sr', 'cr', 'mr', 'od', 'dsr', 'forte', 'plus', 'md',
]);

const sanitizePrescriptionText = (value = '') => value
    .toLowerCase()
    .replace(/[^a-z0-9+\s]/g, ' ')
    .replace(/\b\d{1,2}[:.-]\d{1,2}(?:[:.-]\d{1,2})?\b/g, ' ')
    .replace(/\b20\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}\s*(?:am|pm)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const formatPrescriptionCandidate = (parts = []) => parts
    .map((part) => {
        const lowered = String(part).toLowerCase();
        if (/^\d+(?:\.\d+)?(?:mg|mcg|ml|gm)$/.test(lowered)) return lowered.toUpperCase();
        if (PRESCRIPTION_SUFFIX_WORDS.has(lowered)) return lowered.toUpperCase();
        if (lowered === 'tab' || lowered === 'tablet') return 'Tablet';
        if (lowered === 'cap' || lowered === 'capsule') return 'Capsule';
        if (lowered === 'syrup') return 'Syrup';
        if (PRESCRIPTION_NOISE_WORDS.has(lowered)) return null;
        return lowered.charAt(0).toUpperCase() + lowered.slice(1);
    })
    .filter(Boolean)
    .join(' ')
    .trim();

const extractPrescriptionMedicines = (fileName = '', notes = '') => {
    const normalized = sanitizePrescriptionText(notes || fileName);
    if (!normalized) {
        return [];
    }

    const aliasMatches = Object.entries(PRESCRIPTION_KNOWN_ALIASES)
        .filter(([alias]) => normalized.includes(alias))
        .map(([, medicine]) => medicine);

    if (aliasMatches.length) {
        return [...new Set(aliasMatches)];
    }

    const phrases = normalized.match(/\b([a-z][a-z0-9+-]{2,}(?:\s+[a-z0-9.+-]{1,12}){0,3})\b/g) || [];
    const cleaned = [];

    for (const phrase of phrases) {
        const parts = phrase.split(' ').filter((part) => !PRESCRIPTION_NOISE_WORDS.has(part));
        if (!parts.length) continue;
        if (parts.every((part) => /^\d+$/.test(part))) continue;
        if (parts.length === 1 && (parts[0].length < 4 || /^\d+$/.test(parts[0]))) continue;
        if (!parts.some((part) => /\d/.test(part) || PRESCRIPTION_FORM_WORDS.has(part) || PRESCRIPTION_SUFFIX_WORDS.has(part) || part.length >= 5)) {
            continue;
        }

        const candidate = formatPrescriptionCandidate(parts);
        if (candidate && !cleaned.includes(candidate)) {
            cleaned.push(candidate);
        }
    }

    return cleaned.slice(0, 6);
};

const buildFallbackPrescriptionAnalysis = (file, notes = '', errorMessage = '') => {
    const extractedMedicines = extractPrescriptionMedicines(file?.name || '', notes);
    return {
        status: 'success',
        file_name: file?.name || 'prescription',
        content_type: file?.type || 'application/octet-stream',
        file_size: file?.size || 0,
        notes,
        ocr_status: 'starter-mode-local',
        extracted_medicines: extractedMedicines,
        message: errorMessage
            ? `${errorMessage} Showing local starter extraction for now.`
            : 'Showing local starter extraction for now. Please review detected medicines before comparing.',
        raw_text_preview: (notes || file?.name || '').trim(),
        isFallback: true,
    };
};

const getFriendlyError = (error) => {
    if (error instanceof TypeError) {
        return 'Unable to reach the backend. If you are running locally, start the API server on http://127.0.0.1:8000. If this site is deployed, set VITE_API_BASE_URL to your backend URL.';
    }

    if (error?.name === 'AbortError') {
        return 'The backend took too long to respond. Please try again in a moment.';
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
            return await fetchJsonWithRetry(HEALTH_URL, {}, { retries: 1, timeoutMs: 4000, retryDelayMs: 500 });
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
                { retries: 0, timeoutMs: 3500, retryDelayMs: 400 }
            );
            return { ...data, isFallback: false };
        } catch (error) {
            const fallbackResults = buildFallbackResults(query);
            return {
                query,
                results: fallbackResults,
                summary: buildFallbackSummary(fallbackResults),
                isFallback: true,
                message: getFriendlyError(error) || 'Showing available demo pricing for now.',
            };
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
                { retries: 0, timeoutMs: 2500, retryDelayMs: 400 }
            );
        } catch (error) {
            return {
                query,
                alternatives: buildFallbackAlternatives(query),
                isFallback: true,
                message: getFriendlyError(error),
            };
        }
    },

    getMedicineMetadata: async (query) => {
        try {
            return await fetchJsonWithRetry(
                `${API_BASE_URL}/medicine-metadata?query=${encodeURIComponent(query)}`,
                {},
                { retries: 0, timeoutMs: 2000, retryDelayMs: 300 }
            );
        } catch (error) {
            return {
                ...buildFallbackMetadata(query),
                message: getFriendlyError(error),
            };
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
    },

    analyzePrescription: async (file, notes = '') => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('notes', notes);

        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/prescriptions/analyze`, {
                method: 'POST',
                body: formData,
            }, 12000);
            return handleResponse(response);
        } catch (error) {
            return buildFallbackPrescriptionAnalysis(file, notes, getFriendlyError(error));
        }
    }
};

export default api;
