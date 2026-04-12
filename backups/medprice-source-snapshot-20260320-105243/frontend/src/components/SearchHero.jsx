import React, { useState } from 'react';
import { Search } from 'lucide-react';

const SearchHero = ({ onSearch, loading = false }) => {
    const [query, setQuery] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (query.trim()) {
            onSearch(query.trim());
        }
    };

    return (
        <div className="flex flex-col items-center justify-center text-center py-16 px-4 animate-fade-in">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-brand-50 text-brand-600 border border-brand-100 mb-6 text-sm font-medium">
                <span className="flex h-2 w-2 rounded-full bg-brand-500 mr-2 animate-pulse"></span>
                AI-Powered Pharmacy Aggregator
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
                Find the <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-sky-500">Best Price</span><br className="hidden sm:block" /> for Your Medicines
            </h1>

            <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-10">
                Compare prices instantly across Tata 1mg, PharmEasy, Netmeds, and Apollo Pharmacy.
                Save up to 40% on your prescriptions.
            </p>

            <p className="mb-4 max-w-2xl text-sm text-slate-500">
                Pro tip: search multiple medicines at once with commas like <span className="font-semibold text-slate-700">Dolo 650, Cetirizine, Vitamin C</span>.
            </p>

            <form onSubmit={handleSubmit} className="w-full max-w-2xl relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-6 w-6 text-gray-400 group-focus-within:text-brand-500 transition-colors" />
                </div>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search for medicines like 'Dolo 650', 'Paracetamol'..."
                    className="block w-full pl-12 pr-32 py-4 border-2 border-gray-200 rounded-full leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-lg shadow-sm"
                />
                <button
                    type="submit"
                    disabled={!query.trim() || loading}
                    className="absolute inset-y-1.5 right-1.5 bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50 disabled:cursor-not-allowed font-medium rounded-full px-6 transition-colors shadow-md shadow-brand-500/30"
                >
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </form>

            <div className="flex flex-wrap justify-center gap-2 mt-6">
                <span className="text-sm text-gray-500 mt-1 mr-2">Popular:</span>
                {['Dolo 650', 'Crocin', 'Vitamin C', 'Paracetamol'].map(tag => (
                    <button
                        key={tag}
                        onClick={() => { setQuery(tag); onSearch(tag); }}
                        disabled={loading}
                        className="text-xs bg-white border border-gray-200 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50 rounded-full px-3 py-1.5 transition-colors"
                    >
                        {tag}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default SearchHero;
