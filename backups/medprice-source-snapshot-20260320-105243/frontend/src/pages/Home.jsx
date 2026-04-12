import React, { useEffect, useState } from 'react';
import SearchHero from '../components/SearchHero';
import ComparisonTable from '../components/ComparisonTable';
import api from '../services/api';
import { addSearchHistory, getAlternatives, getNotifications, getPriceLogs, logPriceResults, markNotificationAsSent } from '../services/supabaseData';
import { Loader2, AlertCircle, FlaskConical, Clock3, ShoppingBasket, Sparkles, BellRing } from 'lucide-react';
import { buildBasketSummary, buildPriceForecast } from '../services/priceIntelligence';

const Home = ({ user, onRequireSignIn, backendStatus }) => {
    const [results, setResults] = useState(null);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState('');
    const [alternatives, setAlternatives] = useState([]);
    const [priceLogs, setPriceLogs] = useState([]);
    const [searchSummary, setSearchSummary] = useState(null);
    const [basketResults, setBasketResults] = useState([]);
    const [alertPreferences, setAlertPreferences] = useState(() => {
        try {
            const stored = window.localStorage.getItem('medprice-alert-preferences');
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            return {};
        }
    });

    useEffect(() => {
        window.localStorage.setItem('medprice-alert-preferences', JSON.stringify(alertPreferences));
    }, [alertPreferences]);

    useEffect(() => {
        const handleChatSearch = (event) => {
            const chatQuery = event?.detail?.query;
            if (chatQuery) {
                void handleSearch(chatQuery);
            }
        };

        window.addEventListener('medprice-chat-search', handleChatSearch);
        return () => window.removeEventListener('medprice-chat-search', handleChatSearch);
    });

    const updateAlertPreference = (medicineName, field, value) => {
        setAlertPreferences((current) => ({
            ...current,
            [medicineName]: {
                stockWatch: current[medicineName]?.stockWatch || false,
                refillReminder: current[medicineName]?.refillReminder || '30',
                ...current[medicineName],
                [field]: value,
            },
        }));
    };

    const hydrateSearchData = async (searchQuery, resultRows) => {
        try {
            const [fetchedAlternatives, fetchedPriceLogs, backendAlternatives] = await Promise.all([
                getAlternatives(searchQuery),
                getPriceLogs(searchQuery),
                api.getAlternatives(searchQuery),
            ]);
            const mergedAlternatives = [
                ...(backendAlternatives?.alternatives || []).map((item, index) => ({
                    id: `api-${searchQuery}-${index}`,
                    ...item,
                })),
                ...fetchedAlternatives,
            ];

            const dedupedAlternatives = mergedAlternatives.filter(
                (item, index, array) =>
                    index ===
                    array.findIndex(
                        (candidate) =>
                            candidate.alternative_name?.toLowerCase() === item.alternative_name?.toLowerCase()
                    )
            );

            setAlternatives(dedupedAlternatives);
            if (fetchedPriceLogs.length > 0) {
                setPriceLogs(fetchedPriceLogs);
            }
        } catch (secondaryError) {
            console.error('Supplementary Supabase data error:', secondaryError);
        }

        if (!user) {
            return;
        }

        try {
            await Promise.all([
                addSearchHistory(searchQuery),
                logPriceResults(searchQuery, resultRows),
            ]);

            const bestCurrentPrice = resultRows
                .filter((item) => item.availability === 'In Stock')
                .reduce(
                    (lowest, item) => (Number(item.price) < lowest ? Number(item.price) : lowest),
                    Number.POSITIVE_INFINITY
                );

            if (Number.isFinite(bestCurrentPrice)) {
                const notifications = await getNotifications();
                const matchingNotifications = notifications.filter(
                    (item) =>
                        item.is_active &&
                        item.medicine_name?.toLowerCase() === searchQuery.toLowerCase() &&
                        bestCurrentPrice <= Number(item.target_price)
                );

                await Promise.all(
                    matchingNotifications.map(async (item) => {
                        await api.sendPriceAlertEmail({
                            email: user.email,
                            medicineName: item.medicine_name,
                            targetPrice: Number(item.target_price),
                            currentPrice: bestCurrentPrice,
                        });
                        await markNotificationAsSent(item.id);
                    })
                );
            }
        } catch (historyError) {
            console.error('Supabase write error:', historyError);
        }
    };

    const handleSearch = async (searchQuery) => {
        const queries = [...new Set(searchQuery.split(',').map((item) => item.trim()).filter(Boolean))];
        const primaryQuery = queries[0] || searchQuery;

        setQuery(searchQuery);
        setLoading(true);
        setError(null);
        setNotice('');
        setResults(null);
        setAlternatives([]);
        setPriceLogs([]);
        setSearchSummary(null);
        setBasketResults([]);

        try {
            const basketData = queries.length > 1 ? await api.searchMedicineBasket(queries) : [];
            const data = basketData.length > 0 ? basketData[0] : await api.searchMedicine(primaryQuery);
            const resultRows = data?.results || [];

            if (data?.isFallback) {
                setNotice(data.message || 'Showing fallback results because the backend is currently unavailable.');
            }

            if (data && data.results && data.results.length > 0) {
                setResults(data.results);
            } else {
                setError("Medicine not found or currently unavailable across our platforms. Please check the spelling or try a generic name.");
                return;
            }

            setSearchSummary(data.summary || null);
            setBasketResults(basketData);

            if (resultRows.length > 0) {
                setPriceLogs(
                    resultRows.map((item, index) => ({
                        id: `${primaryQuery}-${item.platform}-${index}`,
                        medicine_name: primaryQuery,
                        platform: item.platform,
                        price: item.price,
                        timestamp: new Date().toISOString(),
                    }))
                );
            }

            void hydrateSearchData(primaryQuery, resultRows);
        } catch (err) {
            console.error(err);
            setError("An error occurred while fetching prices. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const primaryQuery = query.split(',')[0]?.trim() || query;
    const basketSummary = buildBasketSummary(basketResults);
    const priceForecast = buildPriceForecast(primaryQuery, priceLogs, results || []);

    return (
        <div className="flex flex-col items-center w-full pb-20">
            <SearchHero onSearch={handleSearch} loading={loading} />

            {loading && (
                <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
                    <Loader2 size={40} className="text-brand-500 animate-spin mb-4" />
                    <p className="text-gray-500 font-medium">Fetching best prices from multiple pharmacies and retrying live data if needed...</p>
                </div>
            )}

            {error && !loading && (
                <div className="w-full max-w-2xl mx-auto mt-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start text-red-800 animate-fade-in shadow-sm">
                    <AlertCircle size={20} className="mr-3 mt-0.5 flex-shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            {notice && !loading && !error && (
                <div className="w-full max-w-2xl mx-auto mt-6 p-4 bg-sky-50 border border-sky-200 rounded-xl flex items-start text-sky-800 animate-fade-in shadow-sm">
                    <AlertCircle size={20} className="mr-3 mt-0.5 flex-shrink-0 text-sky-600" />
                    <p>{notice}</p>
                </div>
            )}

            {!loading && !error && results && (
                <>
                    <ComparisonTable
                        results={results}
                        query={query}
                        user={user}
                        onRequireSignIn={onRequireSignIn}
                        searchSummary={searchSummary}
                        forecast={priceForecast}
                    />

                    {basketResults.length > 1 ? (
                        <div className="mb-6 w-full max-w-5xl rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-6 shadow-sm">
                            <div className="mb-4 flex items-center gap-2">
                                <ShoppingBasket size={20} className="text-amber-600" />
                                <h3 className="text-lg font-bold text-slate-900">Medicine Basket Optimizer</h3>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="rounded-xl bg-white p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Best Combined Cost</p>
                                    <p className="mt-2 text-2xl font-bold text-slate-900">Rs. {basketSummary.totalBestPrice.toFixed(2)}</p>
                                </div>
                                <div className="rounded-xl bg-white p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Average Combined Cost</p>
                                    <p className="mt-2 text-2xl font-bold text-slate-900">Rs. {basketSummary.totalAveragePrice.toFixed(2)}</p>
                                </div>
                                <div className="rounded-xl bg-white p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Estimated Basket Savings</p>
                                    <p className="mt-2 text-2xl font-bold text-amber-700">Rs. {basketSummary.totalSavings.toFixed(2)}</p>
                                </div>
                            </div>
                            <div className="mt-4 space-y-3">
                                {basketSummary.items.map((item) => (
                                    <div key={item.query} className="flex flex-col rounded-xl border border-amber-100 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <p className="font-semibold text-slate-800">{item.query}</p>
                                            <p className="mt-1 text-sm text-slate-500">Best source: {item.bestPlatform}</p>
                                        </div>
                                        <div className="mt-2 text-sm text-slate-600 md:mt-0">
                                            Best: <span className="font-semibold text-slate-900">Rs. {item.bestPrice.toFixed(2)}</span>
                                            {' '}| Save about <span className="font-semibold text-amber-700">Rs. {item.estimatedSavings.toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    <div className="grid w-full max-w-5xl gap-6 md:grid-cols-2">
                        {alternatives.length > 0 ? (
                            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                                <div className="mb-4 flex items-center gap-2">
                                    <FlaskConical size={20} className="text-brand-500" />
                                    <h3 className="text-lg font-bold text-slate-900">Smart Alternatives</h3>
                                </div>

                                <div className="space-y-3">
                                    {alternatives.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => handleSearch(item.alternative_name)}
                                            className="w-full rounded-xl border border-gray-100 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-brand-200 hover:bg-brand-50"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="font-semibold text-slate-800">{item.alternative_name}</p>
                                                    <p className="mt-1 text-sm text-slate-500">{item.composition || 'Composition not available'}</p>
                                                </div>
                                                {item.dosage_match ? (
                                                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                                                        Dosage Match
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="mt-2 text-xs text-slate-600">{item.match_reason || 'Related alternative'}</p>
                                            {item.price_hint ? (
                                                <p className="mt-1 text-xs font-medium text-amber-700">{item.price_hint}</p>
                                            ) : null}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                            <div className="mb-4 flex items-center gap-2">
                                <Clock3 size={20} className="text-brand-500" />
                                <h3 className="text-lg font-bold text-slate-900">Price Log Snapshot</h3>
                            </div>

                            {priceLogs.length > 0 ? (
                                <div className="space-y-3">
                                    {priceLogs.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-slate-50 px-4 py-3">
                                            <div>
                                                <p className="font-semibold text-slate-800">{item.platform}</p>
                                                <p className="text-xs text-slate-500">
                                                    {new Date(item.timestamp).toLocaleString()}
                                                </p>
                                            </div>
                                            <p className="font-bold text-slate-900">Rs. {Number(item.price).toFixed(2)}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-sm text-slate-500">No price log rows available yet.</p>}
                        </div>
                    </div>

                    <div className="mt-6 grid w-full max-w-5xl gap-6 md:grid-cols-2">
                        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                            <div className="mb-4 flex items-center gap-2">
                                <Sparkles size={20} className="text-brand-500" />
                                <h3 className="text-lg font-bold text-slate-900">Prediction Engine</h3>
                            </div>
                            <div className="space-y-3 text-sm text-slate-600">
                                <p>
                                    Next likely tracked price:
                                    {' '}
                                    <span className="font-semibold text-slate-900">
                                        {priceForecast.predictedNextPrice !== null ? `Rs. ${priceForecast.predictedNextPrice.toFixed(2)}` : 'Not enough data'}
                                    </span>
                                </p>
                                <p>Confidence: <span className="font-semibold text-slate-900">{priceForecast.confidence}</span></p>
                                <p>{priceForecast.bestTimeToBuy}</p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                            <div className="mb-4 flex items-center gap-2">
                                <BellRing size={20} className="text-brand-500" />
                                <h3 className="text-lg font-bold text-slate-900">Personalized Alert Preferences</h3>
                            </div>
                            <div className="space-y-4">
                                <label className="flex items-center justify-between rounded-xl border border-gray-100 bg-slate-50 px-4 py-3">
                                    <span className="text-sm font-medium text-slate-700">Notify me about stock returns</span>
                                    <input
                                        type="checkbox"
                                        checked={Boolean(alertPreferences[primaryQuery]?.stockWatch)}
                                        onChange={(event) => updateAlertPreference(primaryQuery, 'stockWatch', event.target.checked)}
                                    />
                                </label>
                                <label className="block rounded-xl border border-gray-100 bg-slate-50 px-4 py-3">
                                    <span className="text-sm font-medium text-slate-700">Refill reminder cadence</span>
                                    <select
                                        value={alertPreferences[primaryQuery]?.refillReminder || '30'}
                                        onChange={(event) => updateAlertPreference(primaryQuery, 'refillReminder', event.target.value)}
                                        className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-700"
                                    >
                                        <option value="15">Every 15 days</option>
                                        <option value="30">Every 30 days</option>
                                        <option value="45">Every 45 days</option>
                                        <option value="60">Every 60 days</option>
                                    </select>
                                </label>
                                <p className="text-xs text-slate-500">
                                    These preferences are ready for deeper reminder automation once we connect recurring notifications end to end.
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Home;
