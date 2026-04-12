import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SearchHero from '../components/SearchHero';
import ComparisonTable from '../components/ComparisonTable';
import api from '../services/api';
import {
    addSearchHistory,
    getAlternatives,
    getNotifications,
    getPriceLogs,
    logPriceResults,
    markNotificationAsSent,
} from '../services/supabaseData';
import {
    AlertCircle,
    BellRing,
    Loader2,
    SearchCheck,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';
import { buildPriceForecast } from '../services/priceIntelligence';
import { browseCatalog, browseLetters } from '../data/medicineBrowseCatalog';

const howItWorks = [
    {
        step: '1',
        title: 'Search',
        description: 'Search your prescribed medicine.',
    },
    {
        step: '2',
        title: 'Compare',
        description: 'Compare medicine prices across many pharmacies.',
    },
    {
        step: '3',
        title: 'Save upto 85%',
        description: 'Save upto 85% on your medicines.',
    },
];

const whyChooseUs = [
    'User friendly interface.',
    'Compares prices in no time.',
    'Get Budget-Friendly deals.',
    'Save upto 85% on medicines.',
];

const faqItems = [
    {
        question: 'How does MedPrice compare medicine prices?',
        answer: 'We collect pricing from supported pharmacy sources, rank the available offers, and show the lowest visible option first.',
    },
    {
        question: 'Can I search by brand name or salt?',
        answer: 'Yes. You can search with a branded medicine name, a generic salt, or common tablet variants.',
    },
    {
        question: 'Does MedPrice sell medicines directly?',
        answer: 'No. MedPrice helps you compare prices and then redirects you to the selected pharmacy to complete the purchase.',
    },
];

const Home = ({ user, onRequireSignIn, backendStatus }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [results, setResults] = useState(null);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState('');
    const [alternatives, setAlternatives] = useState([]);
    const [priceLogs, setPriceLogs] = useState([]);
    const [searchSummary, setSearchSummary] = useState(null);
    const [medicineMetadata, setMedicineMetadata] = useState(null);
    const [selectedBrowseLetter, setSelectedBrowseLetter] = useState('N');
    const [heroResetKey, setHeroResetKey] = useState(0);

    const resetHomeState = () => {
        setResults(null);
        setQuery('');
        setLoading(false);
        setError(null);
        setNotice('');
        setAlternatives([]);
        setPriceLogs([]);
        setSearchSummary(null);
        setMedicineMetadata(null);
        setHeroResetKey((current) => current + 1);
    };

    useEffect(() => {
        const prescriptionQuery = searchParams.get('prescription_query');
        if (!prescriptionQuery) {
            return;
        }

        void handleSearch(prescriptionQuery);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('prescription_query');
        setSearchParams(nextParams, { replace: true });
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        const handleChatSearch = (event) => {
            const chatQuery = event?.detail?.query;
            if (chatQuery) {
                void handleSearch(chatQuery);
            }
        };

        const handleResetHome = () => {
            resetHomeState();
        };

        const handleNavigateSection = (event) => {
            const sectionId = event?.detail?.sectionId;
            resetHomeState();

            window.setTimeout(() => {
                if (!sectionId) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                }

                const sectionElement = document.getElementById(sectionId);
                if (sectionElement) {
                    sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }, 80);
        };

        window.addEventListener('medprice-chat-search', handleChatSearch);
        window.addEventListener('medprice-reset-home', handleResetHome);
        window.addEventListener('medprice-navigate-section', handleNavigateSection);
        return () => {
            window.removeEventListener('medprice-chat-search', handleChatSearch);
            window.removeEventListener('medprice-reset-home', handleResetHome);
            window.removeEventListener('medprice-navigate-section', handleNavigateSection);
        };
    }, []);

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
        setMedicineMetadata(null);

        try {
            const basketData = queries.length > 1 ? await api.searchMedicineBasket(queries) : [];
            const data = basketData.length > 0 ? basketData[0] : await api.searchMedicine(primaryQuery);
            const resultRows = data?.results || [];

            if (data?.isFallback) {
                setNotice('Showing fallback results right now.');
            }

            if (data && data.results && data.results.length > 0) {
                setResults(data.results);
            } else {
                setError("Medicine not found or currently unavailable across our platforms. Please check the spelling or try a generic name.");
                return;
            }

            setSearchSummary(data.summary || null);
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
            void api.getMedicineMetadata(primaryQuery)
                .then((metadataResponse) => {
                    setMedicineMetadata(metadataResponse?.metadata || null);
                })
                .catch((metadataError) => {
                    console.error('Metadata fetch error:', metadataError);
                });
        } catch (err) {
            console.error(err);
            setError(err?.message || "An error occurred while fetching prices. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const primaryQuery = query.split(',')[0]?.trim() || query;
    const priceForecast = buildPriceForecast(primaryQuery, priceLogs, results || []);
    const selectedBrowseMedicines = browseCatalog[selectedBrowseLetter] || [];

    return (
        <div className="flex flex-col items-center w-full pb-20">
            <SearchHero onSearch={handleSearch} loading={loading} resetKey={heroResetKey} />

            {!results && !loading && !error ? (
                <>
                    <section id="how-it-works" className="mt-6 w-full max-w-6xl border-t border-slate-300 bg-white px-6 py-6 sm:px-8">
                        <h2 className="text-center text-2xl font-bold text-slate-800">How to use MedPrice</h2>
                        <div className="mx-auto mt-6 grid max-w-3xl gap-4 md:grid-cols-3">
                            {howItWorks.map((item) => (
                                <div key={item.step} className="text-center">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-lg font-bold text-amber-600">
                                        {item.step}
                                    </div>
                                    <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
                                    <p className="mt-2 text-sm leading-5 text-slate-600">{item.description}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section id="medi-savings" className="w-full bg-white px-6 py-8">
                        <div className="mx-auto max-w-6xl">
                            <h2 className="text-center text-3xl font-bold text-slate-800">Why to choose MedPrice?</h2>
                            <div className="mt-6 grid gap-4 md:grid-cols-4">
                                {whyChooseUs.map((item, index) => (
                                    <div key={item} className="rounded-xl bg-[#ffe27a] p-4 text-center">
                                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-white text-amber-600">
                                            {index === 0 ? <SearchCheck size={24} /> : index === 1 ? <Sparkles size={24} /> : index === 2 ? <ShieldCheck size={24} /> : <BellRing size={24} />}
                                        </div>
                                        <p className="mt-4 text-sm font-semibold text-slate-900">{item}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section id="about-us" className="w-full border-t border-slate-200 bg-slate-50 px-6 py-10">
                        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-[1.2fr_0.8fr]">
                            <div className="rounded-2xl bg-white p-6 shadow-sm">
                                <h2 className="text-3xl font-bold text-slate-900">About MedPrice</h2>
                                <p className="mt-4 text-base leading-7 text-slate-600">
                                    MedPrice is built to help people compare medicine prices quickly without jumping between multiple pharmacy sites. We focus on a cleaner search experience, faster comparison, and smarter repeat-use features like saved drugs and refill tracking.
                                </p>
                                <p className="mt-4 text-base leading-7 text-slate-600">
                                    Our goal is simple: make it easier to find the best available price and reach the right pharmacy faster.
                                </p>
                            </div>
                            <div className="rounded-2xl bg-white p-6 shadow-sm">
                                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                                    <Sparkles size={16} className="text-amber-500" />
                                    Subscribe to our savings newsletter
                                </div>
                                <div className="mt-4 flex w-full flex-col gap-3">
                                    <input
                                        type="email"
                                        placeholder="Enter your email address"
                                        className="flex-1 rounded border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={onRequireSignIn}
                                        className="rounded bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                                    >
                                        Subscribe
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="mt-8 w-full max-w-6xl bg-white px-6 py-8">
                        <div className="flex flex-col gap-2">
                            <h2 className="text-3xl font-bold tracking-tight text-slate-950">Medicines: {selectedBrowseLetter}</h2>
                            <h3 className="mt-1 text-2xl font-semibold text-slate-900">Browse medications</h3>
                            <p className="max-w-3xl text-base leading-7 text-slate-600">
                                Explore medications and over-the-counter products alphabetically, compare drug prices, and save money today.
                            </p>
                        </div>
                        <div className="mt-8 grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-9 lg:grid-cols-[repeat(13,minmax(0,1fr))]">
                            {browseLetters.map((letter) => (
                                <button
                                    key={letter}
                                    type="button"
                                    onClick={() => setSelectedBrowseLetter(letter)}
                                    className={`rounded-full border px-4 py-3 text-center text-sm font-semibold transition ${
                                        selectedBrowseLetter === letter
                                            ? 'border-amber-400 bg-amber-300 text-slate-950 shadow-sm'
                                            : 'border-amber-300 bg-white text-slate-700 hover:border-amber-400 hover:bg-amber-50'
                                    }`}
                                >
                                    {letter}
                                </button>
                            ))}
                        </div>
                        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {selectedBrowseMedicines.length > 0 ? (
                                selectedBrowseMedicines.map((medicine) => (
                                    <div key={medicine.name} className="rounded border border-slate-300 bg-white p-4 shadow-sm">
                                        <div className="min-h-[92px]">
                                            <p className="text-sm font-bold text-slate-900">{medicine.name}</p>
                                            <p className="mt-1 text-sm text-slate-700 underline">{medicine.company}</p>
                                            <p className="mt-1 text-sm text-slate-700">{medicine.composition}</p>
                                            <p className="mt-1 text-sm text-slate-700">{medicine.pack}</p>
                                        </div>
                                        <div className="mt-4 grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => handleSearch(medicine.composition.split(' + ')[0].split(' ')[0])}
                                                className="rounded-full border border-blue-500 bg-white px-4 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
                                            >
                                                Substitutes
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleSearch(medicine.name)}
                                                className="rounded-full border border-blue-500 bg-white px-4 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
                                            >
                                                Compare
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full rounded-[20px] border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
                                    No medications added for {selectedBrowseLetter} yet. We can expand this into a full A-Z catalog next.
                                </div>
                            )}
                        </div>
                    </section>

                    <section id="faq" className="mt-8 w-full max-w-6xl rounded-2xl bg-white px-6 py-8 shadow-sm">
                        <div className="mx-auto max-w-4xl">
                            <h2 className="text-center text-3xl font-bold text-slate-900">Frequently asked questions</h2>
                            <div className="mt-8 space-y-4">
                                {faqItems.map((item) => (
                                    <div key={item.question} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                        <h3 className="text-lg font-semibold text-slate-900">{item.question}</h3>
                                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.answer}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                </>
            ) : null}

            {loading && (
                <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
                    <Loader2 size={40} className="text-brand-500 animate-spin mb-4" />
                    <p className="text-center font-medium text-gray-500">
                        Fetching best prices from multiple pharmacies and retrying live data if needed...
                    </p>
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
                        alternatives={alternatives}
                        onRefineSearch={handleSearch}
                        metadata={medicineMetadata}
                    />
                </>
            )}
        </div>
    );
};

export default Home;
