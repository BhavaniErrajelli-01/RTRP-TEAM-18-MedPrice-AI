import { supabase } from './supabase';

const DEFAULT_REFILL_DAYS = 30;

const requireSupabase = () => {
    if (!supabase) {
        throw new Error('Supabase is not configured.');
    }
};

const normalizeMedicineName = (value = '') => value.trim().toLowerCase();

const normalizeRefillDays = (value) => {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : DEFAULT_REFILL_DAYS;
};

const buildPlanRecord = (medicineName, overrides = {}, existing = {}) => ({
    medicine_name: medicineName,
    refill_days: normalizeRefillDays(overrides.refill_days ?? existing.refill_days),
    stock_watch: Boolean(overrides.stock_watch ?? existing.stock_watch),
    reminder_enabled: overrides.reminder_enabled ?? existing.reminder_enabled ?? true,
    last_purchase_at: overrides.last_purchase_at ?? existing.last_purchase_at ?? null,
    saved_at: overrides.saved_at ?? existing.saved_at ?? new Date().toISOString(),
    notes: overrides.notes ?? existing.notes ?? '',
    updated_at: new Date().toISOString(),
});

export const upsertSavedMedicinePlan = async (medicineName, plan = {}) => {
    const user = await getCurrentUser();
    const normalizedName = normalizeMedicineName(medicineName);
    if (!normalizedName) {
        throw new Error('Medicine name is required.');
    }

    const { data: existingRow, error: fetchError } = await supabase
        .from('saved_medicines')
        .select('*')
        .eq('user_id', user.id)
        .ilike('medicine_name', medicineName)
        .maybeSingle();

    if (fetchError) {
        throw fetchError;
    }

    const payload = buildPlanRecord(existingRow?.medicine_name || medicineName, plan, existingRow || {});
    const { data, error } = await supabase
        .from('saved_medicines')
        .upsert(
            {
                user_id: user.id,
                ...payload,
            },
            {
                onConflict: 'user_id,medicine_name',
            }
        )
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

const mergeSavedMedicineWithPlan = (savedMedicine, plan = {}) => ({
    ...savedMedicine,
    plan,
    refill_days: normalizeRefillDays(plan.refill_days),
    stock_watch: Boolean(plan.stock_watch),
    reminder_enabled: plan.reminder_enabled ?? true,
    last_purchase_at: plan.last_purchase_at || null,
    notes: plan.notes || '',
});

const getCurrentUser = async () => {
    requireSupabase();

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error) {
        throw error;
    }

    if (!user) {
        throw new Error('Please sign in first.');
    }

    return user;
};

export const getProfile = async () => {
    const user = await getCurrentUser();

    const { data, error } = await supabase
        .from('users')
        .select('id, email, created_at')
        .eq('id', user.id)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return (
        data || {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
        }
    );
};

export const addSearchHistory = async (medicineName) => {
    const user = await getCurrentUser();

    const { error } = await supabase.from('search_history').insert({
        user_id: user.id,
        medicine_name: medicineName,
    });

    if (error) {
        throw error;
    }
};

export const getSearchHistory = async () => {
    const user = await getCurrentUser();

    const { data, error } = await supabase
        .from('search_history')
        .select('*')
        .eq('user_id', user.id)
        .order('searched_at', { ascending: false })
        .limit(20);

    if (error) {
        throw error;
    }

    return data || [];
};

export const saveMedicine = async (medicineName, options = {}) => {
    const user = await getCurrentUser();

    const { error } = await supabase.from('saved_medicines').upsert(
        {
            user_id: user.id,
            medicine_name: medicineName,
            refill_days: normalizeRefillDays(options.refill_days),
            stock_watch: Boolean(options.stock_watch),
            reminder_enabled: options.reminder_enabled ?? true,
            last_purchase_at: options.last_purchase_at ?? null,
            notes: options.notes ?? '',
            updated_at: new Date().toISOString(),
        },
        {
            onConflict: 'user_id,medicine_name',
        }
    );

    if (error) {
        throw error;
    }
};

export const getSavedMedicines = async () => {
    const user = await getCurrentUser();

    const { data, error } = await supabase
        .from('saved_medicines')
        .select('*')
        .eq('user_id', user.id)
        .order('saved_at', { ascending: false });

    if (error) {
        throw error;
    }

    return (data || []).map((item) => mergeSavedMedicineWithPlan(item, item));
};

export const removeSavedMedicine = async (medicineName) => {
    const user = await getCurrentUser();
    const { error } = await supabase
        .from('saved_medicines')
        .delete()
        .eq('user_id', user.id)
        .eq('medicine_name', medicineName);

    if (error) {
        throw error;
    }
};

export const createNotification = async (medicineName, targetPrice) => {
    const user = await getCurrentUser();

    const { data, error } = await supabase
        .from('notifications')
        .insert({
            user_id: user.id,
            medicine_name: medicineName,
            target_price: targetPrice,
        })
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const getNotifications = async () => {
    const user = await getCurrentUser();

    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        throw error;
    }

    return data || [];
};

export const markNotificationAsSent = async (notificationId) => {
    const user = await getCurrentUser();

    const { error } = await supabase
        .from('notifications')
        .update({ is_active: false })
        .eq('id', notificationId)
        .eq('user_id', user.id);

    if (error) {
        throw error;
    }
};

export const getAlternatives = async (medicineName) => {
    requireSupabase();

    const { data, error } = await supabase
        .from('alternatives')
        .select('*')
        .ilike('medicine_name', `%${medicineName}%`)
        .limit(8);

    if (error) {
        throw error;
    }

    return data || [];
};

export const getPriceLogs = async (medicineName) => {
    requireSupabase();

    const { data, error } = await supabase
        .from('price_logs')
        .select('*')
        .ilike('medicine_name', `%${medicineName}%`)
        .order('timestamp', { ascending: false })
        .limit(10);

    if (error) {
        throw error;
    }

    return data || [];
};

export const getPriceLogsForMedicines = async (medicineNames) => {
    requireSupabase();

    const names = [...new Set((medicineNames || []).filter(Boolean))];
    if (!names.length) {
        return [];
    }

    const { data, error } = await supabase
        .from('price_logs')
        .select('*')
        .in('medicine_name', names)
        .order('timestamp', { ascending: false });

    if (error) {
        throw error;
    }

    return data || [];
};

export const logPriceResults = async (medicineName, results) => {
    await getCurrentUser();

    const rows = (results || []).map((item) => ({
        medicine_name: medicineName,
        platform: item.platform,
        price: Number(item.price),
    }));

    if (!rows.length) {
        return;
    }

    const { error } = await supabase.from('price_logs').insert(rows);

    if (error) {
        throw error;
    }
};

export const savePrescription = async ({
    fileName,
    notes = '',
    extractedMedicines = [],
    ocrStatus = 'starter-mode',
    rawTextPreview = '',
}) => {
    const user = await getCurrentUser();

    const { data, error } = await supabase
        .from('prescriptions')
        .insert({
            user_id: user.id,
            file_name: fileName,
            notes,
            extracted_medicines: extractedMedicines,
            ocr_status: ocrStatus,
            raw_text_preview: rawTextPreview,
        })
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const getPrescriptions = async () => {
    const user = await getCurrentUser();

    const { data, error } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        throw error;
    }

    return data || [];
};
