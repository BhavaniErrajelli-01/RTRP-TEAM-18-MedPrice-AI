import React, { useEffect, useState } from 'react';
import { BookmarkPlus, CheckCircle2, ChevronRight, MapPin, XCircle } from 'lucide-react';
import { saveMedicine } from '../services/supabaseData';
import { getBestAvailableResult } from '../services/priceIntelligence';

const PLATFORM_SEARCH_URLS = {
    PharmEasy: (query) => `https://pharmeasy.in/search/all?name=${encodeURIComponent(query)}`,
    Netmeds: (query) => `https://www.netmeds.com/catalogsearch/result/${encodeURIComponent(query)}/all`,
    'Tata 1mg': (query) => `https://www.1mg.com/search/all?name=${encodeURIComponent(query)}`,
    'Apollo Pharmacy': (query) => `https://www.apollopharmacy.in/search-medicines/${encodeURIComponent(query)}`,
    Truemeds: (query) => `https://www.truemeds.in/search?name=${encodeURIComponent(query)}`,
    'Amazon Pharmacy': (query) => `https://www.amazon.in/s?k=${encodeURIComponent(query)}+medicine`,
    'MedPlus Mart': (query) => `https://www.medplusmart.com/search?searchTerm=${encodeURIComponent(query)}`,
};

const DOSAGE_HINTS = {
    glycomet: ['250MG', '500MG', '850MG', '1000MG'],
    'glycomet gp1': ['0.5MG/500MG', '1MG/500MG', '2MG/500MG'],
    paracetamol: ['500MG', '650MG'],
    dolo: ['500MG', '650MG'],
    crocin: ['500MG', '650MG'],
    cetirizine: ['5MG', '10MG'],
    pantocid: ['20MG', '40MG'],
    telma: ['20MG', '40MG', '80MG'],
};

const QUANTITY_OPTIONS_BY_FORM = {
    Tablet: ['10 Tablets', '15 Tablets', '20 Tablets', '30 Tablets'],
    Capsule: ['10 Capsules', '15 Capsules', '30 Capsules'],
    Syrup: ['60 ml', '100 ml', '200 ml'],
    Drops: ['10 ml', '15 ml', '30 ml'],
    Cream: ['15 gm', '20 gm', '30 gm'],
    Injection: ['1 vial', '2 vials'],
};

const MEDICINE_INFO = {
    'glycomet gp1': {
        generic: 'Glimepiride + Metformin',
        uses: 'This combination is commonly prescribed to help manage blood sugar levels in type 2 diabetes.',
        howToUse: 'It is often taken with food to reduce stomach upset, but the exact timing should follow the doctor’s advice.',
        sideEffects: 'Common issues may include low blood sugar, nausea, stomach discomfort, or dizziness in some patients.',
        benefits: 'It combines two diabetes medicines in one tablet, which can help improve blood sugar control more conveniently.',
        substituteNote: 'Substitutes should match both the glimepiride and metformin strength before considering a switch.',
    },
    glycomet: {
        generic: 'Metformin',
        uses: 'Metformin is commonly used to help manage blood sugar in type 2 diabetes.',
        howToUse: 'It is often taken with meals, but the exact schedule should match the doctor’s prescription.',
        sideEffects: 'Stomach upset, nausea, loose stools, or bloating can happen in some patients.',
        benefits: 'It helps improve blood sugar control and is widely used for long-term diabetes management.',
        substituteNote: 'Match the exact metformin strength and release type before comparing alternatives.',
    },
    dolo: {
        generic: 'Paracetamol',
        uses: 'Dolo is commonly used for fever reduction and relief from mild to moderate pain.',
        howToUse: 'Take only the prescribed dose and do not exceed the daily limit for paracetamol-containing medicines.',
        sideEffects: 'It is usually well tolerated, but overdose can seriously affect the liver.',
        benefits: 'It is a familiar option for fever and body pain relief and is widely available.',
        substituteNote: 'Many substitutes use the same paracetamol composition, so dosage matching is important.',
    },
    crocin: {
        generic: 'Paracetamol',
        uses: 'Crocin is commonly used to relieve fever, headache, and mild body pain.',
        howToUse: 'Use the exact strength shown on the strip and avoid mixing with other paracetamol products unless advised.',
        sideEffects: 'It is generally well tolerated when used correctly, but overuse can affect the liver.',
        benefits: 'It offers familiar fever and pain relief with easy availability across pharmacies.',
        substituteNote: 'Paracetamol-based substitutes should match the same strength whenever possible.',
    },
    paracetamol: {
        generic: 'Paracetamol',
        uses: 'Paracetamol is commonly used for fever and mild to moderate pain relief.',
        howToUse: 'Follow the dose advised by a doctor or the package label, especially for children or syrup forms.',
        sideEffects: 'Overdose can be dangerous for the liver, so multiple paracetamol products should not be combined carelessly.',
        benefits: 'It is one of the most widely used fever and pain medicines and is available in many forms.',
        substituteNote: 'Substitutes should be checked for the same strength and dosage form.',
    },
    pantocid: {
        generic: 'Pantoprazole',
        uses: 'Pantocid is commonly used for acidity, reflux, and stomach acid-related symptoms.',
        howToUse: 'It is often taken before food, but the exact timing depends on the prescription.',
        sideEffects: 'Some people may notice headache, nausea, or stomach discomfort.',
        benefits: 'It helps reduce excess stomach acid and may improve reflux or gastritis symptoms.',
        substituteNote: 'Pantoprazole substitutes should match the same strength and delayed-release form if applicable.',
    },
    telma: {
        generic: 'Telmisartan',
        uses: 'Telma is commonly prescribed to help control high blood pressure.',
        howToUse: 'It is usually taken once daily, but the timing should match the doctor’s instructions.',
        sideEffects: 'Some patients may notice dizziness, weakness, or low blood pressure symptoms.',
        benefits: 'It helps manage blood pressure and may reduce long-term cardiovascular risk when used regularly.',
        substituteNote: 'Check that substitutes match the same telmisartan strength before switching.',
    },
    cetirizine: {
        generic: 'Cetirizine',
        uses: 'Cetirizine is commonly used for allergy symptoms such as sneezing, itching, and runny nose.',
        howToUse: 'It is often taken once daily, but some people may prefer evening use if drowsiness occurs.',
        sideEffects: 'Drowsiness, dry mouth, or mild tiredness can occur in some patients.',
        benefits: 'It helps control allergy symptoms with a simple once-daily dosing pattern in many cases.',
        substituteNote: 'Substitutes should match the same cetirizine strength and form.',
    },
    limcee: {
        generic: 'Vitamin C',
        uses: 'Limcee is commonly used as a vitamin C supplement.',
        howToUse: 'Use according to the label or prescription, especially if it is being taken regularly.',
        sideEffects: 'Mild stomach discomfort or acidity can happen in some people.',
        benefits: 'It offers a convenient vitamin C supplement form and is widely available.',
        substituteNote: 'Compare substitutes by the same vitamin C strength.',
    },
};

const normalizeDisplayValue = (value, fallback) => (typeof value === 'string' && value.trim() ? value.toUpperCase() : fallback);

const inferForm = (query = '') => {
    const normalized = query.toLowerCase();
    if (normalized.includes('syrup') || normalized.includes('suspension')) return 'Syrup';
    if (normalized.includes('capsule')) return 'Capsule';
    if (normalized.includes('drop')) return 'Drops';
    if (normalized.includes('cream') || normalized.includes('ointment') || normalized.includes('gel')) return 'Cream';
    if (normalized.includes('injection')) return 'Injection';
    return 'Tablet';
};

const buildBaseMedicineName = (query = '') =>
    query
        .replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml)\b/gi, '')
        .replace(/\b\d+\s*(?:tablet|tablets|capsule|capsules|vial|vials)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

const inferDosage = (query = '', searchSummary = null) => {
    const explicit = query.match(/(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml))/i)?.[1];
    if (explicit) {
        return explicit.toUpperCase().replace(/\s+/g, '');
    }

    if (searchSummary?.dosage_context) {
        return String(searchSummary.dosage_context).toUpperCase();
    }

    return 'Not specified';
};

const inferQuantity = (form, query = '') => {
    const explicitTablets = query.match(/(\d+)\s*(tablet|tablets|capsule|capsules)/i);
    if (explicitTablets) {
        return `${explicitTablets[1]} ${explicitTablets[2][0].toUpperCase()}${explicitTablets[2].slice(1).toLowerCase()}`;
    }

    if (form === 'Syrup') return '100 ml';
    if (form === 'Drops') return '15 ml';
    if (form === 'Cream') return '20 gm';
    if (form === 'Injection') return '1 vial';
    if (form === 'Capsule') return '10 Capsules';
    return '10 Tablets';
};

const inferDosageOptions = (query = '', searchSummary = null) => {
    const inferred = inferDosage(query, searchSummary);
    const normalized = query.toLowerCase();
    const hintEntry = Object.entries(DOSAGE_HINTS).find(([key]) => normalized.includes(key));
    const options = hintEntry ? hintEntry[1] : [];

    return [...new Set([inferred, ...options].filter(Boolean))];
};

const inferQuantityOptions = (form, query = '') => {
    const inferred = inferQuantity(form, query);
    return [...new Set([inferred, ...(QUANTITY_OPTIONS_BY_FORM[form] || ['10 Tablets'])])];
};

const normalizeExternalUrl = (url) => {
    if (!url || url === '#') {
        return null;
    }

    if (/^https?:\/\//i.test(url)) {
        return url;
    }

    if (url.startsWith('//')) {
        return `https:${url}`;
    }

    return `https://${url.replace(/^\/+/, '')}`;
};

const resolveBuyUrl = (item, query) => normalizeExternalUrl(item?.url) || PLATFORM_SEARCH_URLS[item?.platform]?.(query) || null;
const formatPrice = (value) => `Rs. ${Number(value).toFixed(2)}`;

const getMedicineProfile = (query = '', metadata = null) => {
    const normalized = `${metadata?.base_name || ''} ${query}`.toLowerCase();
    const match = Object.entries(MEDICINE_INFO).find(([key]) => normalized.includes(key));
    return match ? match[1] : null;
};

const TAB_CONTENT_BUILDERS = {
    Overview: ({ query, bestResult, searchSummary, profile, selectedDosage, selectedForm }) => ({
        title: 'Overview',
        body: bestResult
            ? `${query}${profile?.generic ? ` (${profile.generic})` : ''} is currently available across multiple pharmacies, with ${bestResult.platform} showing the lowest visible price right now at ${formatPrice(bestResult.price)}.`
            : `${query} can be compared across supported pharmacy links here.`,
        extra: `${selectedDosage !== 'Not specified' ? `Selected strength: ${selectedDosage}. ` : ''}${selectedForm ? `Form: ${selectedForm}. ` : ''}${searchSummary?.best_time_to_buy || 'Compare the current prices and use alerts if you want to wait for a better dip.'}`,
    }),
    Uses: ({ query, profile }) => ({
        title: 'Uses',
        body: profile?.uses || `${query} should be used only for the purpose advised by a doctor, pharmacist, or the official product guidance.`,
        extra: profile?.generic
            ? `Generic/composition: ${profile.generic}. Always confirm the exact medicine name, strength, and form before ordering.`
            : 'Always confirm the exact medicine name, strength, and form before ordering.',
    }),
    'How to use': ({ query, selectedForm, selectedDosage, selectedQuantity, profile }) => ({
        title: 'How to use',
        body: profile?.howToUse || `Review the selected medicine details for ${query}${selectedDosage !== 'Not specified' ? ` (${selectedDosage})` : ''} in ${selectedForm.toLowerCase()} form before buying.`,
        extra: `Current quantity shown: ${selectedQuantity}. Follow your doctor's prescription for dosage and timing.`,
    }),
    'Side effects': ({ query, profile }) => ({
        title: 'Side effects',
        body: profile?.sideEffects || `Side effects for ${query} depend on the exact composition and strength. Check the strip, label, or doctor guidance before use.`,
        extra: 'Do not rely on a price comparison page alone for medical advice.',
    }),
    Benefits: ({ query, searchSummary, profile }) => ({
        title: 'Benefits',
        body: profile?.benefits || `The main benefit of this page is faster price comparison for ${query} across pharmacy sources.`,
        extra: searchSummary?.price_prediction || 'You can also save the drug and revisit it later for repeat purchases.',
    }),
    Substitutes: ({ alternatives, query, profile }) => ({
        title: 'Substitutes',
        body: alternatives.length
            ? 'Here are related substitutes or alternatives you can review and compare.'
            : `No strong substitute matches were found yet for ${query}.`,
        extra: profile?.substituteNote || 'For prescription medicines, confirm substitution with a doctor or pharmacist first.',
    }),
};

const ComparisonTable = ({ results, query, user, onRequireSignIn, alternatives = [], searchSummary = null, onRefineSearch, metadata = null }) => {
    if (!results?.length) {
        return null;
    }

    const bestResult = getBestAvailableResult(results);
    const baseMedicineName = metadata?.base_name || buildBaseMedicineName(query) || query;
    const initialForm = metadata?.form || inferForm(query);
    const dosageOptions = metadata?.dosages?.length ? metadata.dosages : inferDosageOptions(query, searchSummary);
    const initialQuantityOptions = metadata?.quantities?.length ? metadata.quantities : inferQuantityOptions(initialForm, query);
    const [selectedForm, setSelectedForm] = useState(initialForm);
    const [selectedDosage, setSelectedDosage] = useState(normalizeDisplayValue(metadata?.dosage || dosageOptions[0], 'Not specified'));
    const quantityOptions = metadata?.quantities?.length ? metadata.quantities : inferQuantityOptions(selectedForm, query);
    const [selectedQuantity, setSelectedQuantity] = useState(metadata?.quantity || initialQuantityOptions[0] || '10 Tablets');
    const [activeTab, setActiveTab] = useState('Substitutes');
    const medicineProfile = getMedicineProfile(query, metadata);

    useEffect(() => {
        const nextForm = metadata?.form || inferForm(query);
        const nextDosageOptions = metadata?.dosages?.length ? metadata.dosages : inferDosageOptions(query, searchSummary);
        const nextQuantityOptions = metadata?.quantities?.length ? metadata.quantities : inferQuantityOptions(nextForm, query);
        setSelectedForm(nextForm);
        setSelectedDosage(normalizeDisplayValue(metadata?.dosage || nextDosageOptions[0], 'Not specified'));
        setSelectedQuantity(metadata?.quantity || nextQuantityOptions[0] || '10 Tablets');
        setActiveTab('Substitutes');
    }, [query, searchSummary, metadata]);

    const triggerRefineSearch = (nextForm, nextDosage, nextQuantity) => {
        const queryParts = [baseMedicineName];
        if (nextDosage && nextDosage !== 'Not specified') {
            queryParts.push(nextDosage);
        }
        if (nextForm && nextForm !== 'Tablet') {
            queryParts.push(nextForm);
        }
        if (nextQuantity) {
            queryParts.push(nextQuantity);
        }
        onRefineSearch?.(queryParts.join(' ').trim());
    };

    const handleSave = async () => {
        if (!user) {
            onRequireSignIn?.();
            return;
        }

        try {
            await saveMedicine(query, { refill_days: 30, stock_watch: false });
            window.alert(`${query} saved successfully.`);
        } catch (error) {
            window.alert(error.message || 'Unable to save right now.');
        }
    };

    const tabContent = TAB_CONTENT_BUILDERS[activeTab]?.({
        query,
        bestResult,
        searchSummary,
        selectedForm,
        selectedDosage,
        selectedQuantity,
        alternatives,
        profile: medicineProfile,
    }) || TAB_CONTENT_BUILDERS.Substitutes({ alternatives, query, profile: medicineProfile });

    return (
        <section className="w-full max-w-5xl px-4 py-8 sm:px-6">
            <div className="border-t border-slate-200 pt-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-950">{query}</h1>
                        <p className="mt-2 text-sm text-slate-600">
                            {bestResult ? `Best available price starts from ${formatPrice(bestResult.price)}` : 'Compare pharmacy prices instantly.'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="inline-flex items-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                        <BookmarkPlus size={14} className="mr-2" />
                        Save Drug
                    </button>
                </div>

                <div className="mt-8 rounded-xl border border-slate-300 bg-white p-4">
                    <div className="grid gap-3 md:grid-cols-[1.2fr_0.9fr_0.9fr_auto]">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-500">Medication</label>
                            <input value={baseMedicineName} readOnly className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-500">Form</label>
                            <select
                                value={selectedForm}
                                onChange={(event) => {
                                    const nextForm = event.target.value;
                                    const nextQuantity = (metadata?.quantities?.length ? metadata.quantities : inferQuantityOptions(nextForm, query))[0] || selectedQuantity;
                                    setSelectedForm(nextForm);
                                    setSelectedQuantity(nextQuantity);
                                    triggerRefineSearch(nextForm, selectedDosage, nextQuantity);
                                }}
                                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                            >
                                {(metadata?.forms?.length ? metadata.forms : ['Tablet', 'Capsule', 'Syrup', 'Drops', 'Cream', 'Injection']).map((item) => (
                                    <option key={item} value={item}>{item}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-500">Dosage</label>
                            <select
                                value={selectedDosage}
                                onChange={(event) => {
                                    const nextDosage = event.target.value;
                                    setSelectedDosage(nextDosage);
                                    triggerRefineSearch(selectedForm, nextDosage, selectedQuantity);
                                }}
                                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                            >
                                {dosageOptions.map((item) => (
                                    <option key={item} value={item}>{item}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-500">Quantity</label>
                            <select
                                value={selectedQuantity}
                                onChange={(event) => {
                                    const nextQuantity = event.target.value;
                                    setSelectedQuantity(nextQuantity);
                                    triggerRefineSearch(selectedForm, selectedDosage, nextQuantity);
                                }}
                                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                            >
                                {quantityOptions.map((item) => (
                                    <option key={item} value={item}>{item}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="mt-5 flex items-center justify-between text-sm text-slate-600">
                    <div className="inline-flex items-center">
                        <MapPin size={14} className="mr-1" />
                        Delhi, DL
                    </div>
                    <button type="button" onClick={handleSave} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                        Save Drug
                    </button>
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-5 py-4">
                        <h2 className="text-lg font-bold text-slate-900">Lowest pharmacy prices</h2>
                        <p className="text-sm text-slate-500">Choose a pharmacy to get lowest price</p>
                    </div>
                    <div className="divide-y divide-slate-200">
                        {results.map((item, index) => {
                            const savingPercent = bestResult ? Math.max(0, Math.round(((Number(item.price) - Number(bestResult.price)) / Number(item.price || 1)) * 100)) : 0;
                            const externalUrl = resolveBuyUrl(item, query);
                            const canBuy = item.availability === 'In Stock' && Boolean(externalUrl);
                            return (
                                <div key={`${item.platform}-${index}`} className="grid items-center gap-4 px-5 py-4 md:grid-cols-[1.3fr_auto_auto_auto]">
                                    <div className="flex items-center gap-3">
                                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${item.availability === 'In Stock' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {item.availability === 'In Stock' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900">{item.platform}</p>
                                            <p className="text-xs text-slate-500">{item.availability}</p>
                                        </div>
                                    </div>
                                    <div className="text-xs font-semibold text-emerald-700">
                                        {item.best_deal ? 'Best price' : `Save ${savingPercent}%`}
                                    </div>
                                    <div className="text-2xl font-bold text-slate-900">{formatPrice(item.price)}</div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (canBuy && externalUrl) {
                                                window.open(externalUrl, '_blank', 'noopener,noreferrer');
                                            }
                                        }}
                                        className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold ${
                                            canBuy
                                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                : 'cursor-not-allowed bg-slate-200 text-slate-400'
                                        }`}
                                    >
                                        Buy Now
                                        <ChevronRight size={14} className="ml-1" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-8 rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex flex-wrap gap-2">
                        {['Overview', 'Uses', 'How to use', 'Side effects', 'Benefits', 'Substitutes'].map((tab) => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveTab(tab)}
                                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                    tab === activeTab
                                        ? 'border-blue-600 bg-blue-600 text-white'
                                        : 'border-slate-300 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                    <h3 className="text-3xl font-bold text-slate-800">{tabContent.title}</h3>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{tabContent.body}</p>
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">{tabContent.extra}</p>
                    {activeTab === 'Substitutes' ? (
                        <div className="mt-5 flex flex-wrap gap-3">
                            {(alternatives.length ? alternatives.map((item) => item.alternative_name) : [query]).slice(0, 8).map((name) => (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => onRefineSearch?.(name)}
                                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-500 hover:text-blue-600"
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
        </section>
    );
};

export default ComparisonTable;
