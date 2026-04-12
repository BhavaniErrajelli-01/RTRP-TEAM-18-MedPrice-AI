import React from 'react';
import { BellPlus, BookmarkPlus, CheckCircle2, ExternalLink, Gauge, PiggyBank, Sparkles, TrendingDown, XCircle } from 'lucide-react';
import api from '../services/api';
import { createNotification, markNotificationAsSent, saveMedicine } from '../services/supabaseData';
import { getBestAvailableResult, summarizeSearchResults } from '../services/priceIntelligence';

const ComparisonTable = ({ results, query, user, onRequireSignIn, searchSummary = null, forecast = null }) => {
    if (!results || results.length === 0) {
        return null;
    }

    const summary = summarizeSearchResults(results);
    const bestResult = getBestAvailableResult(results);

    const handleSave = async () => {
        if (!user) {
            onRequireSignIn?.();
            return;
        }

        try {
            await saveMedicine(query);
            window.alert(`${query} was saved to your dashboard.`);
        } catch (error) {
            console.error('Save medicine error:', error);
            window.alert(error.message || 'Unable to save this medicine right now.');
        }
    };

    const handleSetAlert = async () => {
        if (!user) {
            onRequireSignIn?.();
            return;
        }

        const inStockResults = results.filter((item) => item.availability === 'In Stock');
        const bestCurrentPrice = (inStockResults.length ? inStockResults : results).reduce(
            (lowest, item) => (Number(item.price) < lowest ? Number(item.price) : lowest),
            Number.POSITIVE_INFINITY
        );

        const value = window.prompt(
            `Set a target price for ${query}`,
            Number.isFinite(bestCurrentPrice) ? bestCurrentPrice.toString() : results[0]?.price?.toString() || ''
        );
        if (!value) {
            return;
        }

        const parsedPrice = Number(value);
        if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
            window.alert('Please enter a valid price.');
            return;
        }

        try {
            const notification = await createNotification(query, parsedPrice);
            if (Number.isFinite(bestCurrentPrice) && bestCurrentPrice <= parsedPrice) {
                await api.sendPriceAlertEmail({
                    email: user.email,
                    medicineName: query,
                    targetPrice: parsedPrice,
                    currentPrice: bestCurrentPrice,
                });
                await markNotificationAsSent(notification.id);
                window.alert(
                    `Price alert set for ${query} at Rs. ${parsedPrice.toFixed(2)}. The current best price is already Rs. ${bestCurrentPrice.toFixed(2)}, so we emailed you now.`
                );
            } else if (Number.isFinite(bestCurrentPrice)) {
                window.alert(
                    `Price alert set for ${query} at Rs. ${parsedPrice.toFixed(2)}. Current best price: Rs. ${bestCurrentPrice.toFixed(2)}.`
                );
            } else {
                window.alert(`Price alert set for ${query} at Rs. ${parsedPrice.toFixed(2)}.`);
            }
        } catch (error) {
            console.error('Create notification error:', error);
            window.alert(error.message || 'Unable to set a price alert right now.');
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto mt-8 mb-10 animate-fade-in">
            <div className="mb-6 flex flex-col items-center justify-between md:flex-row">
                <h2 className="text-2xl font-bold text-gray-800">
                    Results for <span className="text-brand-600 capitalize">"{query}"</span>
                </h2>
                <div className="mt-4 flex flex-col gap-3 md:mt-0 md:flex-row">
                    <button
                        onClick={handleSave}
                        className="flex items-center space-x-2 rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50 hover:text-brand-700"
                    >
                        <BookmarkPlus size={16} />
                        <span>Save Medicine</span>
                    </button>
                    <button
                        onClick={handleSetAlert}
                        className="flex items-center space-x-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-100 hover:text-brand-700"
                    >
                        <BellPlus size={16} />
                        <span>Set Price Alert</span>
                    </button>
                </div>
            </div>

            <div className="mb-6 grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-700">Best Deal</p>
                    <p className="mt-3 text-2xl font-bold text-slate-900">Rs. {summary.bestPrice.toFixed(2)}</p>
                    <p className="mt-1 text-sm text-slate-600">{summary.bestPlatform}</p>
                </div>
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-sky-700">
                        <Gauge size={16} />
                        <p className="text-xs font-semibold uppercase tracking-[0.2em]">Market Average</p>
                    </div>
                    <p className="mt-3 text-2xl font-bold text-slate-900">Rs. {summary.averagePrice.toFixed(2)}</p>
                    <p className="mt-1 text-sm text-slate-600">{summary.inStockCount} pharmacies in stock</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-amber-700">
                        <PiggyBank size={16} />
                        <p className="text-xs font-semibold uppercase tracking-[0.2em]">You Could Save</p>
                    </div>
                    <p className="mt-3 text-2xl font-bold text-slate-900">Rs. {summary.estimatedSavings.toFixed(2)}</p>
                    <p className="mt-1 text-sm text-slate-600">By choosing the lowest current price</p>
                </div>
                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">Price Spread</p>
                    <p className="mt-3 text-2xl font-bold text-slate-900">{summary.spreadPercent}%</p>
                    <p className="mt-1 text-sm text-slate-600">Rs. {summary.spreadAmount.toFixed(2)} between best and highest</p>
                </div>
            </div>

            {(searchSummary || forecast) ? (
                <div className="mb-6 grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-slate-700">
                            <Sparkles size={16} />
                            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Best Time To Buy</p>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-700">
                            {forecast?.bestTimeToBuy || searchSummary?.best_time_to_buy || 'Not enough data yet.'}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Price Prediction</p>
                        <p className="mt-3 text-2xl font-bold text-slate-900">
                            {forecast?.predictedNextPrice !== null && forecast?.predictedNextPrice !== undefined
                                ? `Rs. ${Number(forecast.predictedNextPrice).toFixed(2)}`
                                : 'N/A'}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                            {searchSummary?.price_prediction || 'Short-term guidance based on recent tracked prices.'}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">Confidence</p>
                        <p className="mt-3 text-2xl font-bold text-slate-900">{forecast?.confidence || 'Low'}</p>
                        <p className="mt-1 text-sm text-slate-600">
                            {searchSummary?.dosage_context
                                ? `Dosage context detected: ${searchSummary.dosage_context}`
                                : 'Confidence improves as more price logs are collected.'}
                        </p>
                    </div>
                </div>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-gray-200 bg-gray-50 text-sm uppercase tracking-wider text-gray-500">
                                <th className="px-6 py-4 font-semibold">Pharmacy</th>
                                <th className="px-6 py-4 font-semibold">Price</th>
                                <th className="px-6 py-4 font-semibold">Insight</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                                <th className="px-6 py-4 text-right font-semibold">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {results.map((item, index) => {
                                const priceGap = bestResult ? Number(item.price) - Number(bestResult.price) : 0;
                                const insightLabel = item.best_deal
                                    ? 'Lowest price right now'
                                    : priceGap <= 0
                                    ? 'Matches the best deal'
                                    : `Rs. ${priceGap.toFixed(2)} above the best deal`;

                                return (
                                <tr
                                    key={index}
                                    className={`transition-colors hover:bg-brand-50/30 ${item.best_deal ? 'relative bg-green-50/50' : ''}`}
                                >
                                    <td className="flex items-center px-6 py-5 font-medium text-gray-900">
                                        {item.platform}
                                        {item.best_deal ? (
                                            <span className="ml-3 inline-flex items-center rounded border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-bold leading-5 text-green-800">
                                                <TrendingDown size={12} className="mr-1" />
                                                Best Deal
                                            </span>
                                        ) : null}
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className={`text-lg font-bold ${item.best_deal ? 'text-green-600' : 'text-gray-900'}`}>
                                            Rs. {Number(item.price).toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span
                                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                                item.best_deal
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-slate-100 text-slate-700'
                                            }`}
                                        >
                                            {insightLabel}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span
                                            className={`flex items-center text-sm font-medium ${
                                                item.availability === 'In Stock' ? 'text-green-600' : 'text-red-500'
                                            }`}
                                        >
                                            {item.availability === 'In Stock' ? (
                                                <CheckCircle2 size={16} className="mr-1.5" />
                                            ) : (
                                                <XCircle size={16} className="mr-1.5" />
                                            )}
                                            {item.availability}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <a
                                            href={item.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                                                item.availability === 'In Stock'
                                                    ? item.best_deal
                                                        ? 'bg-green-600 text-white shadow-sm hover:bg-green-700'
                                                        : 'bg-brand-500 text-white shadow-sm hover:bg-brand-600'
                                                    : 'cursor-not-allowed bg-gray-100 text-gray-400'
                                            }`}
                                            onClick={(event) => item.availability !== 'In Stock' && event.preventDefault()}
                                        >
                                            Buy Now
                                            <ExternalLink size={14} className="ml-1.5" />
                                        </a>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ComparisonTable;
