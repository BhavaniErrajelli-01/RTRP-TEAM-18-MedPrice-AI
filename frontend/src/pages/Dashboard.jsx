import React, { useEffect, useState } from 'react';
import {
    BarChart3,
    BellRing,
    Bookmark,
    CalendarClock,
    History,
    PackageCheck,
    PiggyBank,
    TrendingDown,
    UserCircle2,
} from 'lucide-react';
import {
    getNotifications,
    getPriceLogsForMedicines,
    getProfile,
    getSavedMedicines,
    getSearchHistory,
    removeSavedMedicine,
    upsertSavedMedicinePlan,
} from '../services/supabaseData';
import { buildWalletInsights, summarizeTrackedMedicines } from '../services/priceIntelligence';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const TrendMiniChart = ({ points = [] }) => {
    if (!points.length) {
        return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">No trend points yet.</div>;
    }

    const prices = points.map((item) => Number(item.price));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice || 1;

    return (
        <div className="flex h-28 items-end gap-2 rounded-xl bg-slate-50 p-4">
            {points.map((point) => {
                const height = 28 + ((Number(point.price) - minPrice) / range) * 60;

                return (
                    <div key={point.id} className="flex flex-1 flex-col items-center justify-end gap-2">
                        <div
                            className="w-full rounded-t-full bg-gradient-to-t from-brand-500 to-sky-400"
                            style={{ height: `${height}px` }}
                            title={`${point.label}: Rs. ${Number(point.price).toFixed(2)}`}
                        />
                        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{point.label.split(' ')[0]}</span>
                    </div>
                );
            })}
        </div>
    );
};

const buildRefillStatus = (savedMedicine) => {
    const refillDays = Number(savedMedicine.refill_days) || 30;
    const anchorDateValue = savedMedicine.last_purchase_at || savedMedicine.saved_at;

    if (!anchorDateValue) {
        return { refillDays, nextRefillDate: null, daysUntilRefill: null, statusLabel: 'Plan not started', statusTone: 'bg-slate-100 text-slate-700' };
    }

    const anchorDate = new Date(anchorDateValue);
    const nextRefillDate = new Date(anchorDate.getTime() + refillDays * ONE_DAY_MS);
    const daysUntilRefill = Math.ceil((nextRefillDate.getTime() - Date.now()) / ONE_DAY_MS);

    if (daysUntilRefill <= 0) {
        return { refillDays, nextRefillDate, daysUntilRefill, statusLabel: 'Refill due now', statusTone: 'bg-red-100 text-red-700' };
    }

    if (daysUntilRefill <= 7) {
        return { refillDays, nextRefillDate, daysUntilRefill, statusLabel: `Due in ${daysUntilRefill} day${daysUntilRefill === 1 ? '' : 's'}`, statusTone: 'bg-amber-100 text-amber-700' };
    }

    return { refillDays, nextRefillDate, daysUntilRefill, statusLabel: `Next refill in ${daysUntilRefill} days`, statusTone: 'bg-emerald-100 text-emerald-700' };
};

const Dashboard = ({ user, onRequireSignIn }) => {
    const [profile, setProfile] = useState(null);
    const [history, setHistory] = useState([]);
    const [savedMedicines, setSavedMedicines] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [priceLogs, setPriceLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refreshTick, setRefreshTick] = useState(0);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!user) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError('');

            try {
                const [profileData, historyData, savedData, notificationsData] = await Promise.all([
                    getProfile(),
                    getSearchHistory(),
                    getSavedMedicines(),
                    getNotifications(),
                ]);

                const medicineNamesForLogs = [
                    ...historyData.slice(0, 6).map((item) => item.medicine_name),
                    ...savedData.map((item) => item.medicine_name),
                    ...notificationsData.map((item) => item.medicine_name),
                ];
                const fetchedPriceLogs = await getPriceLogsForMedicines(medicineNamesForLogs);
                const latestPriceByMedicine = fetchedPriceLogs.reduce((accumulator, item) => {
                    if (!accumulator[item.medicine_name]) {
                        accumulator[item.medicine_name] = item;
                    }
                    return accumulator;
                }, {});

                setProfile(profileData);
                setHistory(historyData);
                setSavedMedicines(savedData);
                setPriceLogs(fetchedPriceLogs);
                setNotifications(
                    notificationsData.map((item) => {
                        const latestLog = latestPriceByMedicine[item.medicine_name];
                        const latestPrice = latestLog ? Number(latestLog.price) : null;
                        return {
                            ...item,
                            latest_price: latestPrice,
                            latest_price_at: latestLog?.timestamp || null,
                            is_reached: latestPrice !== null && latestPrice <= Number(item.target_price),
                            email_sent: item.is_active === false,
                        };
                    })
                );
            } catch (fetchError) {
                console.error('Dashboard fetch error:', fetchError);
                setError(fetchError.message || 'Unable to load your dashboard right now.');
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [user, refreshTick]);

    if (!user) {
        return (
            <div className="mx-auto flex w-full max-w-3xl flex-col items-center rounded-3xl border border-gray-200 bg-white px-8 py-14 text-center shadow-sm">
                <UserCircle2 size={48} className="mb-4 text-brand-500" />
                <h1 className="text-3xl font-bold text-slate-900">Sign in to view your dashboard</h1>
                <p className="mt-3 text-slate-500">Your recent searches, saved medicines, alerts, and refill plan details will appear here.</p>
                <button
                    onClick={onRequireSignIn}
                    className="mt-6 rounded-full bg-gradient-to-r from-brand-500 to-sky-500 px-6 py-3 font-semibold text-white shadow-md shadow-brand-500/20 transition-opacity hover:opacity-90"
                >
                    Continue with Gmail
                </button>
            </div>
        );
    }

    const trackedInsights = summarizeTrackedMedicines({ savedMedicines, notifications, priceLogs });
    const walletInsights = buildWalletInsights({ history, savedMedicines, notifications, priceLogs });
    const topOpportunity = trackedInsights.summaries.slice().sort((left, right) => right.possibleSavings - left.possibleSavings)[0];
    const savedMedicinesWithRefill = savedMedicines.map((item) => ({ ...item, refill: buildRefillStatus(item) }));
    const dueNowCount = savedMedicinesWithRefill.filter((item) => item.refill.daysUntilRefill !== null && item.refill.daysUntilRefill <= 0).length;
    const dueSoonCount = savedMedicinesWithRefill.filter((item) => item.refill.daysUntilRefill !== null && item.refill.daysUntilRefill > 0 && item.refill.daysUntilRefill <= 7).length;

    const refresh = () => setRefreshTick((value) => value + 1);

    const handleUpdateRefillCadence = async (item) => {
        const value = window.prompt(`Refill reminder cadence for ${item.medicine_name} (days)`, String(item.refill_days || 30));
        if (!value) return;
        const refillDays = Number(value);
        if (!Number.isFinite(refillDays) || refillDays <= 0) {
            window.alert('Enter a valid number of days.');
            return;
        }
        await upsertSavedMedicinePlan(item.medicine_name, { refill_days: refillDays, stock_watch: item.stock_watch, last_purchase_at: item.last_purchase_at, notes: item.notes });
        refresh();
    };

    const handleMarkRefilled = async (item) => {
        await upsertSavedMedicinePlan(item.medicine_name, { refill_days: item.refill_days, stock_watch: item.stock_watch, last_purchase_at: new Date().toISOString(), notes: item.notes });
        refresh();
    };

    const handleToggleStockWatch = async (item) => {
        await upsertSavedMedicinePlan(item.medicine_name, { refill_days: item.refill_days, stock_watch: !item.stock_watch, last_purchase_at: item.last_purchase_at, notes: item.notes });
        refresh();
    };

    const handleRemoveSavedMedicine = async (item) => {
        if (!window.confirm(`Remove ${item.medicine_name} from your watchlist?`)) return;
        await removeSavedMedicine(item.medicine_name);
        refresh();
    };

    return (
        <div className="w-full max-w-6xl mx-auto py-10 px-4 animate-fade-in">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900">Your Dashboard</h1>
                <p className="mt-2 text-slate-500">Track savings, refill timing, watchlist health, and price drops in one place.</p>
            </div>

            {loading ? (
                <div className="rounded-2xl border border-gray-200 bg-white px-6 py-8 text-sm text-gray-500 shadow-sm">Loading your dashboard...</div>
            ) : error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 shadow-sm">{error}</div>
            ) : (
                <div className="grid gap-6">
                    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-sky-700"><BarChart3 size={18} /><p className="text-xs font-semibold uppercase tracking-[0.2em]">Tracked Medicines</p></div>
                            <p className="mt-3 text-3xl font-bold text-slate-900">{trackedInsights.trackedCount}</p>
                            <p className="mt-1 text-sm text-slate-600">Saved medicines and active alert items with trend data</p>
                        </div>
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-amber-700"><CalendarClock size={18} /><p className="text-xs font-semibold uppercase tracking-[0.2em]">Refill Due Soon</p></div>
                            <p className="mt-3 text-3xl font-bold text-slate-900">{dueSoonCount}</p>
                            <p className="mt-1 text-sm text-slate-600">{dueNowCount} medicines already due for reorder</p>
                        </div>
                        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-green-700"><TrendingDown size={18} /><p className="text-xs font-semibold uppercase tracking-[0.2em]">Falling Trends</p></div>
                            <p className="mt-3 text-3xl font-bold text-slate-900">{trackedInsights.downwardTrendCount}</p>
                            <p className="mt-1 text-sm text-slate-600">Medicines whose latest tracked price is moving down</p>
                        </div>
                        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-violet-700"><BellRing size={18} /><p className="text-xs font-semibold uppercase tracking-[0.2em]">Alerts Reached</p></div>
                            <p className="mt-3 text-3xl font-bold text-slate-900">{trackedInsights.reachedAlerts}</p>
                            <p className="mt-1 text-sm text-slate-600">{trackedInsights.activeAlerts} alerts still actively watching prices</p>
                        </div>
                    </section>

                    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="mb-4 flex items-center gap-2"><UserCircle2 size={22} className="text-brand-500" /><h2 className="text-xl font-bold text-slate-900">Profile</h2></div>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">Email</p><p className="mt-2 font-semibold text-slate-800">{profile?.email || user.email}</p></div>
                            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">User ID</p><p className="mt-2 truncate font-semibold text-slate-800">{profile?.id}</p></div>
                            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">Joined</p><p className="mt-2 font-semibold text-slate-800">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unavailable'}</p></div>
                        </div>
                    </section>

                    <section className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
                        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                            <div className="mb-5 flex items-center gap-2"><PackageCheck size={20} className="text-brand-500" /><h2 className="text-lg font-bold text-slate-900">Watchlist and Refill Plans</h2></div>
                            {savedMedicinesWithRefill.length > 0 ? (
                                <div className="grid gap-4 lg:grid-cols-2">
                                    {savedMedicinesWithRefill.map((item) => (
                                        <div key={item.id} className="rounded-2xl border border-gray-100 bg-slate-50 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="font-semibold text-slate-900">{item.medicine_name}</p>
                                                    <p className="mt-1 text-xs text-slate-500">Saved on {new Date(item.saved_at).toLocaleDateString()}</p>
                                                </div>
                                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.refill.statusTone}`}>{item.refill.statusLabel}</span>
                                            </div>
                                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                                <div className="rounded-xl bg-white px-3 py-3"><p className="text-[11px] uppercase tracking-wide text-slate-400">Cadence</p><p className="mt-1 font-semibold text-slate-800">Every {item.refill.refillDays} days</p></div>
                                                <div className="rounded-xl bg-white px-3 py-3"><p className="text-[11px] uppercase tracking-wide text-slate-400">Next refill</p><p className="mt-1 font-semibold text-slate-800">{item.refill.nextRefillDate ? item.refill.nextRefillDate.toLocaleDateString() : 'Not set'}</p></div>
                                            </div>
                                            <div className="mt-3 rounded-xl bg-white px-3 py-3 text-sm text-slate-600">
                                                <p>Stock watch: <span className="font-semibold text-slate-900">{item.stock_watch ? 'On' : 'Off'}</span></p>
                                                <p className="mt-1">Last refill marked: <span className="font-semibold text-slate-900">{item.last_purchase_at ? new Date(item.last_purchase_at).toLocaleDateString() : 'Not marked yet'}</span></p>
                                            </div>
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                <button type="button" onClick={() => handleMarkRefilled(item)} className="rounded-full bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-600">Mark refilled today</button>
                                                <button type="button" onClick={() => handleUpdateRefillCadence(item)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-700">Change cadence</button>
                                                <button type="button" onClick={() => handleToggleStockWatch(item)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-700">{item.stock_watch ? 'Turn off stock watch' : 'Turn on stock watch'}</button>
                                                <button type="button" onClick={() => handleRemoveSavedMedicine(item)} className="rounded-full border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50">Remove</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">Save medicines from search results to start building your watchlist and refill plan.</p>
                            )}
                        </div>

                        <div className="grid gap-6">
                            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                                <div className="mb-5 flex items-center gap-2"><PiggyBank size={20} className="text-brand-500" /><h2 className="text-lg font-bold text-slate-900">Best Opportunity</h2></div>
                                {topOpportunity ? (
                                    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
                                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">Watch This One</p>
                                        <p className="mt-3 text-2xl font-bold text-slate-900">{topOpportunity.medicineName}</p>
                                        <p className="mt-2 text-sm text-slate-600">Latest tracked price: <span className="font-semibold text-slate-900">Rs. {topOpportunity.latestPrice?.toFixed(2)}</span></p>
                                        <p className="mt-2 text-sm text-slate-600">Target price: <span className="font-semibold text-slate-900">{topOpportunity.targetPrice !== null ? `Rs. ${topOpportunity.targetPrice.toFixed(2)}` : 'Not set'}</span></p>
                                        <p className="mt-4 rounded-xl bg-white/80 px-4 py-3 text-sm text-slate-700">Potential savings if your alert hits: <span className="font-semibold text-amber-700">Rs. {topOpportunity.possibleSavings.toFixed(2)}</span></p>
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500">Set a few alerts and we will surface the strongest savings opportunity here.</p>
                                )}
                            </section>

                            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                                <div className="mb-4 flex items-center gap-2"><PiggyBank size={20} className="text-brand-500" /><h2 className="text-lg font-bold text-slate-900">Wallet Savings</h2></div>
                                <div className="space-y-4">
                                    <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">Monthly Savings Potential</p><p className="mt-2 text-2xl font-bold text-slate-900">Rs. {walletInsights.monthlySavings.toFixed(2)}</p></div>
                                    <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">Avoided Overspending</p><p className="mt-2 text-2xl font-bold text-green-700">Rs. {walletInsights.avoidedOverspending.toFixed(2)}</p></div>
                                </div>
                            </section>
                        </div>
                    </section>

                    <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                            <div className="mb-5 flex items-center gap-2"><BarChart3 size={20} className="text-brand-500" /><h2 className="text-lg font-bold text-slate-900">Price Intelligence</h2></div>
                            {trackedInsights.summaries.length > 0 ? (
                                <div className="grid gap-4 lg:grid-cols-2">
                                    {trackedInsights.summaries.slice(0, 4).map((item) => (
                                        <div key={item.medicineName} className="rounded-2xl border border-gray-100 bg-slate-50 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="font-semibold text-slate-900">{item.medicineName}</p>
                                                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">Trend {item.trendDirection === 'down' ? 'cooling' : item.trendDirection === 'up' ? 'rising' : 'stable'}</p>
                                                </div>
                                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.trendDirection === 'down' ? 'bg-green-100 text-green-700' : item.trendDirection === 'up' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'}`}>{item.latestPrice !== null ? `Rs. ${item.latestPrice.toFixed(2)}` : 'No latest price'}</span>
                                            </div>
                                            <div className="mt-4"><TrendMiniChart points={item.points} /></div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">Save medicines or create alerts to unlock tracked price intelligence.</p>
                            )}
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                            <div className="mb-4 flex items-center gap-2"><History size={20} className="text-brand-500" /><h2 className="text-lg font-bold text-slate-900">Frequent Medicines</h2></div>
                            {walletInsights.frequentMedicines.length > 0 ? (
                                <div className="space-y-3">
                                    {walletInsights.frequentMedicines.map((item) => (
                                        <div key={item.medicine_name} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                                            <p className="font-semibold text-slate-800">{item.medicine_name}</p>
                                            <span className="rounded-full bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-700">{item.count} searches</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">Search history will surface your most-used medicines here.</p>
                            )}
                        </div>
                    </section>

                    <div className="grid gap-6 lg:grid-cols-3">
                        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                            <div className="mb-4 flex items-center gap-2"><History size={20} className="text-brand-500" /><h2 className="text-lg font-bold text-slate-900">Recent Searches</h2></div>
                            {history.length > 0 ? (
                                <div className="space-y-3">
                                    {history.map((item) => (
                                        <div key={item.id} className="rounded-xl border border-gray-100 bg-slate-50 px-4 py-3">
                                            <p className="font-semibold text-slate-800">{item.medicine_name}</p>
                                            <p className="mt-1 text-xs text-slate-500">{new Date(item.searched_at).toLocaleString()}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">No search history rows yet.</p>
                            )}
                        </section>

                        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                            <div className="mb-4 flex items-center gap-2"><Bookmark size={20} className="text-brand-500" /><h2 className="text-lg font-bold text-slate-900">Saved Medicines</h2></div>
                            {savedMedicinesWithRefill.length > 0 ? (
                                <div className="space-y-3">
                                    {savedMedicinesWithRefill.map((item) => (
                                        <div key={item.id} className="rounded-xl border border-gray-100 bg-slate-50 px-4 py-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="font-semibold text-slate-800">{item.medicine_name}</p>
                                                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.refill.statusTone}`}>{item.refill.statusLabel}</span>
                                            </div>
                                            <p className="mt-2 text-xs text-slate-500">Every {item.refill.refillDays} days {item.refill.nextRefillDate ? `· Next ${item.refill.nextRefillDate.toLocaleDateString()}` : ''}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">No saved medicines yet.</p>
                            )}
                        </section>

                        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                            <div className="mb-4 flex items-center gap-2"><BellRing size={20} className="text-brand-500" /><h2 className="text-lg font-bold text-slate-900">Price Alerts</h2></div>
                            {notifications.length > 0 ? (
                                <div className="space-y-3">
                                    {notifications.map((item) => (
                                        <div key={item.id} className="rounded-xl border border-gray-100 bg-slate-50 px-4 py-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="font-semibold text-slate-800">{item.medicine_name}</p>
                                                <span className="rounded-full bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-700">Rs. {Number(item.target_price).toFixed(2)}</span>
                                            </div>
                                            <div className="mt-2 flex items-center justify-between gap-3">
                                                <p className="text-xs text-slate-500">Created on {new Date(item.created_at).toLocaleString()}</p>
                                                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.email_sent ? 'bg-sky-100 text-sky-700' : item.is_reached ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{item.email_sent ? 'Email Sent' : item.is_reached ? 'Alert Reached' : 'Watching Price'}</span>
                                            </div>
                                            <p className="mt-2 text-xs text-slate-500">{item.latest_price !== null ? `Latest tracked price: Rs. ${item.latest_price.toFixed(2)}` : 'No tracked price yet for this medicine.'}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">No price alerts set yet.</p>
                            )}
                        </section>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
