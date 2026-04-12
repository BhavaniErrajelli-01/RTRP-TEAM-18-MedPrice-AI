import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Pill, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { browseCatalog } from '../data/medicineBrowseCatalog';

const pharmacies = [
    { name: 'netmeds', sublabel: 'India Ki Pharmacy', className: 'text-cyan-500' },
    { name: 'PharmEasy', sublabel: '', className: 'text-emerald-600' },
    { name: 'Apollo Pharmacy', sublabel: '', className: 'text-teal-700' },
    { name: 'pharmacy+', sublabel: '', className: 'text-teal-700' },
    { name: 'Flipkart Health+', sublabel: '', className: 'text-lime-600' },
];

const quickSearches = ['Dolo 650 Tablet', 'Glycomet 500 Tablet', 'Pantocid 40 Tablet'];

const allBrowseMedicines = Object.values(browseCatalog)
    .flat()
    .map((item) => (typeof item === 'string' ? { name: item } : item))
    .filter((item) => item?.name);

const SearchHero = ({ onSearch, loading = false, resetKey = 0 }) => {
    const [query, setQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchBoxRef = useRef(null);

    useEffect(() => {
        setQuery('');
        setShowSuggestions(false);
    }, [resetKey]);

    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (!searchBoxRef.current?.contains(event.target)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    const suggestions = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (normalized.length < 2) {
            return [];
        }

        return allBrowseMedicines
            .filter((item) => item.name.toLowerCase().includes(normalized))
            .slice(0, 5);
    }, [query]);

    const submitSearch = (value) => {
        const trimmed = value.trim();
        if (!trimmed) {
            return;
        }

        setQuery(trimmed);
        setShowSuggestions(false);
        onSearch(trimmed);
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        submitSearch(query);
    };

    return (
        <section className="w-full">
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#f9fcff_0%,#eef7ff_52%,#fffaf0_100%)] px-5 pb-12 pt-10 shadow-[0_22px_60px_rgba(15,23,42,0.08)] sm:px-8">
                <div className="absolute -left-16 top-8 h-40 w-40 rounded-full bg-cyan-100/70 blur-3xl"></div>
                <div className="absolute -right-10 top-0 h-48 w-48 rounded-full bg-amber-100/80 blur-3xl"></div>

                <div className="relative mx-auto max-w-5xl">
                    <div className="mx-auto max-w-3xl text-center">
                        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
                            <Sparkles size={14} />
                            MedPrice Savings
                        </div>
                        <h1 className="mt-6 text-4xl font-black leading-tight text-slate-950 sm:text-5xl">
                            Find the lowest medicine price without the clutter
                        </h1>
                        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                            Search a medicine, compare pharmacy prices, and move straight to the best available option in seconds.
                        </p>
                    </div>

                    <div className="mx-auto mt-8 max-w-4xl rounded-[1.75rem] border border-slate-200 bg-white/90 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur">
                        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div ref={searchBoxRef} className="relative flex-1">
                                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(event) => {
                                        setQuery(event.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => {
                                        if (query.trim().length >= 2) {
                                            setShowSuggestions(true);
                                        }
                                    }}
                                    placeholder="Search medicine name or salt"
                                    className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-base text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                />
                                {showSuggestions && suggestions.length ? (
                                    <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-30 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.14)]">
                                        <div className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                            Suggestions
                                        </div>
                                        {suggestions.map((item) => (
                                            <button
                                                key={item.name}
                                                type="button"
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={() => submitSearch(item.name)}
                                                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                            >
                                                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                                                    <Pill size={16} />
                                                </span>
                                                <span className="font-semibold">{item.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>

                            <button
                                type="submit"
                                disabled={!query.trim() || loading}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[210px]"
                            >
                                {loading ? 'Searching...' : 'Find lowest prices'}
                                <ArrowRight size={16} />
                            </button>
                        </form>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Popular</span>
                            {quickSearches.map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => submitSearch(item)}
                                    className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white hover:text-slate-950"
                                >
                                    {item}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-sm">
                            <ShieldCheck size={15} className="text-emerald-600" />
                            Compare trusted pharmacy links
                        </span>
                        <span className="rounded-full bg-white/80 px-4 py-2 shadow-sm">
                            Search brands, salts, and tablets faster
                        </span>
                    </div>
                </div>
            </div>

            <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white px-5 py-8 shadow-sm sm:px-8">
                <div className="mx-auto max-w-6xl">
                    <h2 className="text-center text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                        Available on popular pharmacies nationwide
                    </h2>
                    <div className="mt-8 grid gap-4 text-center sm:grid-cols-2 lg:grid-cols-5">
                        {pharmacies.map((item) => (
                            <div key={item.name} className="flex min-h-[118px] flex-col items-center justify-center rounded-[1.35rem] border border-slate-200 bg-slate-50/80 px-4 transition hover:-translate-y-1 hover:bg-white hover:shadow-md">
                                <div className={`text-3xl font-black ${item.className}`}>{item.name}</div>
                                {item.sublabel ? <div className="mt-1 text-sm font-semibold text-slate-600">{item.sublabel}</div> : null}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default SearchHero;
