const normalizeMedicineName = (value = '') => value.trim().toLowerCase();

const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2));

export const getBestAvailableResult = (results = []) => {
    const candidates = results.filter((item) => item.availability === 'In Stock');
    const source = candidates.length > 0 ? candidates : results;

    if (!source.length) {
        return null;
    }

    return source.reduce((lowest, item) => (
        Number(item.price) < Number(lowest.price) ? item : lowest
    ));
};

export const summarizeSearchResults = (results = []) => {
    if (!results.length) {
        return {
            bestPrice: 0,
            averagePrice: 0,
            spreadAmount: 0,
            spreadPercent: 0,
            estimatedSavings: 0,
            inStockCount: 0,
            bestPlatform: 'Unavailable',
        };
    }

    const prices = results
        .map((item) => Number(item.price))
        .filter((price) => Number.isFinite(price));

    if (!prices.length) {
        return {
            bestPrice: 0,
            averagePrice: 0,
            spreadAmount: 0,
            spreadPercent: 0,
            estimatedSavings: 0,
            inStockCount: results.filter((item) => item.availability === 'In Stock').length,
            bestPlatform: 'Unavailable',
        };
    }

    const bestResult = getBestAvailableResult(results);
    const highestPrice = Math.max(...prices);
    const averagePrice = prices.reduce((total, price) => total + price, 0) / prices.length;
    const bestPrice = Number(bestResult?.price || 0);
    const spreadAmount = highestPrice - bestPrice;

    return {
        bestPrice: roundCurrency(bestPrice),
        averagePrice: roundCurrency(averagePrice),
        spreadAmount: roundCurrency(spreadAmount),
        spreadPercent: averagePrice > 0 ? Math.round((spreadAmount / averagePrice) * 100) : 0,
        estimatedSavings: roundCurrency(averagePrice - bestPrice),
        inStockCount: results.filter((item) => item.availability === 'In Stock').length,
        bestPlatform: bestResult?.platform || 'Unavailable',
    };
};

export const buildMedicineTimeline = (medicineName, priceLogs = []) => {
    const normalizedMedicineName = normalizeMedicineName(medicineName);
    const relevantLogs = priceLogs
        .filter((item) => normalizeMedicineName(item.medicine_name) === normalizedMedicineName)
        .slice()
        .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());

    const points = relevantLogs.slice(-8).map((item, index) => ({
        id: item.id || `${normalizedMedicineName}-${item.platform}-${index}`,
        label: item.platform,
        price: Number(item.price),
        timestamp: item.timestamp,
    }));

    if (!points.length) {
        return {
            points: [],
            latestPrice: null,
            lowestPrice: null,
            highestPrice: null,
            averagePrice: null,
            trendDirection: 'flat',
        };
    }

    const priceValues = points.map((item) => item.price).filter((price) => Number.isFinite(price));
    const latestPrice = priceValues[priceValues.length - 1];
    const lowestPrice = Math.min(...priceValues);
    const highestPrice = Math.max(...priceValues);
    const averagePrice = priceValues.reduce((total, price) => total + price, 0) / priceValues.length;
    const firstPrice = priceValues[0];
    const lastPrice = priceValues[priceValues.length - 1];

    let trendDirection = 'flat';
    if (lastPrice < firstPrice) {
        trendDirection = 'down';
    } else if (lastPrice > firstPrice) {
        trendDirection = 'up';
    }

    return {
        points,
        latestPrice: roundCurrency(latestPrice),
        lowestPrice: roundCurrency(lowestPrice),
        highestPrice: roundCurrency(highestPrice),
        averagePrice: roundCurrency(averagePrice),
        trendDirection,
    };
};

export const summarizeTrackedMedicines = ({
    savedMedicines = [],
    notifications = [],
    priceLogs = [],
}) => {
    const medicineNames = [
        ...savedMedicines.map((item) => item.medicine_name),
        ...notifications.map((item) => item.medicine_name),
    ].filter(Boolean);

    const uniqueMedicineNames = [...new Set(medicineNames.map(normalizeMedicineName))];
    const summaries = uniqueMedicineNames.map((medicineName) => {
        const displayName = medicineNames.find((item) => normalizeMedicineName(item) === medicineName) || medicineName;
        const timeline = buildMedicineTimeline(displayName, priceLogs);
        const activeAlert = notifications.find(
            (item) => normalizeMedicineName(item.medicine_name) === medicineName && item.is_active
        );

        const possibleSavings = activeAlert && timeline.latestPrice !== null
            ? roundCurrency(Math.max(0, timeline.latestPrice - Number(activeAlert.target_price)))
            : 0;

        return {
            medicineName: displayName,
            ...timeline,
            targetPrice: activeAlert ? roundCurrency(activeAlert.target_price) : null,
            possibleSavings,
        };
    }).filter((item) => item.points.length > 0);

    const estimatedSavings = summaries.reduce((total, item) => total + item.possibleSavings, 0);
    const downwardTrendCount = summaries.filter((item) => item.trendDirection === 'down').length;
    const activeAlerts = notifications.filter((item) => item.is_active).length;
    const reachedAlerts = notifications.filter((item) => item.is_active === false).length;

    return {
        summaries,
        trackedCount: summaries.length,
        activeAlerts,
        reachedAlerts,
        downwardTrendCount,
        estimatedSavings: roundCurrency(estimatedSavings),
    };
};

export const buildPriceForecast = (medicineName, priceLogs = [], fallbackResults = []) => {
    const timeline = buildMedicineTimeline(medicineName, priceLogs);
    const prices = timeline.points.map((item) => Number(item.price)).filter((price) => Number.isFinite(price));

    if (prices.length < 2) {
        const fallbackBest = getBestAvailableResult(fallbackResults);
        return {
            predictedNextPrice: fallbackBest ? roundCurrency(fallbackBest.price) : null,
            confidence: 'Low',
            trendDirection: timeline.trendDirection,
            bestTimeToBuy: fallbackBest
                ? 'Current best price looks reasonable. Set an alert if you can wait.'
                : 'Not enough data yet to suggest a buying window.',
        };
    }

    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const avgStep = (lastPrice - firstPrice) / (prices.length - 1);
    const predictedNextPrice = roundCurrency(lastPrice + avgStep);

    let bestTimeToBuy = 'Prices look relatively stable right now.';
    if (avgStep < -0.2) {
        bestTimeToBuy = 'Prices are trending down. Waiting a little may help if the medicine is not urgently needed.';
    } else if (avgStep > 0.2) {
        bestTimeToBuy = 'Prices are trending up. Buying now could help avoid paying more later.';
    }

    return {
        predictedNextPrice,
        confidence: prices.length >= 4 ? 'Medium' : 'Low',
        trendDirection: timeline.trendDirection,
        bestTimeToBuy,
    };
};

export const buildBasketSummary = (basketResults = []) => {
    if (!basketResults.length) {
        return {
            items: [],
            totalBestPrice: 0,
            totalAveragePrice: 0,
            totalSavings: 0,
            bestPlatforms: [],
        };
    }

    const items = basketResults.map((item) => {
        const summary = summarizeSearchResults(item.results || []);
        return {
            query: item.query,
            bestPlatform: summary.bestPlatform,
            bestPrice: summary.bestPrice,
            averagePrice: summary.averagePrice,
            estimatedSavings: summary.estimatedSavings,
        };
    });

    return {
        items,
        totalBestPrice: roundCurrency(items.reduce((total, item) => total + item.bestPrice, 0)),
        totalAveragePrice: roundCurrency(items.reduce((total, item) => total + item.averagePrice, 0)),
        totalSavings: roundCurrency(items.reduce((total, item) => total + item.estimatedSavings, 0)),
        bestPlatforms: [...new Set(items.map((item) => item.bestPlatform).filter(Boolean))],
    };
};

export const buildWalletInsights = ({
    history = [],
    savedMedicines = [],
    notifications = [],
    priceLogs = [],
}) => {
    const tracked = summarizeTrackedMedicines({ savedMedicines, notifications, priceLogs });
    const monthlySavings = tracked.summaries.reduce((total, item) => {
        if (item.latestPrice === null || item.lowestPrice === null) {
            return total;
        }

        return total + Math.max(0, item.latestPrice - item.lowestPrice);
    }, 0);

    const frequentMedicinesMap = history.reduce((accumulator, item) => {
        const normalized = normalizeMedicineName(item.medicine_name);
        accumulator[normalized] = accumulator[normalized] || {
            medicine_name: item.medicine_name,
            count: 0,
        };
        accumulator[normalized].count += 1;
        return accumulator;
    }, {});

    const frequentMedicines = Object.values(frequentMedicinesMap)
        .sort((left, right) => right.count - left.count)
        .slice(0, 5);

    const bestPlatformsMap = priceLogs.reduce((accumulator, item) => {
        const medicineName = normalizeMedicineName(item.medicine_name);
        if (!accumulator[medicineName] || Number(item.price) < Number(accumulator[medicineName].price)) {
            accumulator[medicineName] = item;
        }
        return accumulator;
    }, {});

    const bestPlatformCounts = Object.values(bestPlatformsMap).reduce((accumulator, item) => {
        accumulator[item.platform] = (accumulator[item.platform] || 0) + 1;
        return accumulator;
    }, {});

    const bestPlatforms = Object.entries(bestPlatformCounts)
        .map(([platform, count]) => ({ platform, count }))
        .sort((left, right) => right.count - left.count);

    return {
        monthlySavings: roundCurrency(monthlySavings),
        avoidedOverspending: roundCurrency(tracked.estimatedSavings + monthlySavings),
        frequentMedicines,
        bestPlatforms,
    };
};
